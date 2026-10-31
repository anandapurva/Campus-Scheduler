// ============================================================
// query.services.js
// Campus Scheduler - Natural Language Query Service
//
// Supported Intents:
//   FACULTY
//   ROOM
//   SUBJECT
//   SEMESTER
//
// Main Pipeline:
//   1. Text normalization
//   2. Intent detection
//   3. Entity extraction
//      - Department
//      - Program
//      - Semester
//      - Faculty
//      - Faculty ID
//      - Faculty abbreviation
//      - Room
//      - Capacity
//      - Room type
//      - Negation / exclusion
//   4. Schema-aware SQL generation
//   5. Parameterized SQL execution
//   6. Structured result generation
//
// ROOM DATA RULES:
//   - CSE rooms may be stored as "CSE & IT"
//   - General rooms may be stored as "ALL"
//   - Room types:
//         L = Lecture
//         T = Tutorial
//         P = Practical / Lab
// ============================================================

const db = require("../config/db");

// ============================================================
// BASIC HELPERS
// ============================================================

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[?.,!;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanPersonName(value) {
    return normalizeText(value)
        .replace(
            /\b(dr|doctor|prof|professor|mr|mrs|ms|miss)\b/g,
            " "
        )
        .replace(/\s+/g, " ")
        .trim();
}

function escapeIdentifier(value) {
    return "`" + String(value).replace(/`/g, "``") + "`";
}

function getField(row, candidates) {
    if (!row) return null;

    const keys = Object.keys(row);

    for (const candidate of candidates) {
        const found = keys.find(
            key =>
                key.toLowerCase() ===
                candidate.toLowerCase()
        );

        if (found) {
            return row[found];
        }
    }

    return null;
}

function hasWord(text, word) {
    return new RegExp(
        `\\b${word}\\b`,
        "i"
    ).test(text);
}

// ============================================================
// TABLE / COLUMN INFORMATION
// ============================================================

const schemaCache = {};

async function getTableColumns(tableName) {

    if (schemaCache[tableName]) {
        return schemaCache[tableName];
    }

    const [rows] =
        await db.query(
            `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
            `,
            [tableName]
        );

    const columns =
        rows.map(
            row => row.COLUMN_NAME
        );

    schemaCache[tableName] =
        columns;

    return columns;
}

async function tableExists(tableName) {

    const columns =
        await getTableColumns(
            tableName
        );

    return columns.length > 0;
}

function findColumn(
    columns,
    candidates
) {

    for (const candidate of candidates) {

        const found =
            columns.find(
                column =>
                    column.toLowerCase() ===
                    candidate.toLowerCase()
            );

        if (found) {
            return found;
        }
    }

    return null;
}

// ============================================================
// INTENT DETECTION
//
// IMPORTANT:
// Specific intents are checked before generic SEMESTER.
//
// Example:
//
// "cse sem7 subject"
//
// must be SUBJECT, not SEMESTER.
// ============================================================

function detectIntent(text) {

    const t =
        normalizeText(text);

    console.log(
        "INTENT TEXT:",
        t
    );

    // ========================================================
    // SUBJECT
    // ========================================================

    const subjectPattern =
        /\b(subject|subjects|course|courses|paper|papers|subejct|subjet|subj)\b/i;

    if (
        subjectPattern.test(t)
    ) {

        console.log(
            "INTENT => SUBJECT"
        );

        return "SUBJECT";
    }

    // ========================================================
    // ROOM
    // ========================================================

    const roomPattern =
        /\b(room|rooms|classroom|classrooms|lab|labs|laboratory|laboratories|lecture\s*room|tutorial\s*room)\b/i;

    if (
        roomPattern.test(t)
    ) {

        console.log(
            "INTENT => ROOM"
        );

        return "ROOM";
    }

    // ========================================================
    // FACULTY
    // ========================================================

    const facultyPattern =
        /\b(faculty|faculties|teacher|teachers|professor|professors|prof|lecturer|lecturers|email|mail)\b/i;

    if (
        facultyPattern.test(t)
    ) {

        console.log(
            "INTENT => FACULTY"
        );

        return "FACULTY";
    }

    // ========================================================
    // SEMESTER
    // ========================================================

    if (
        /\b(semester|sem|semesters)\b/i.test(t) ||
        /\bsem\d+\b/i.test(t)
    ) {

        console.log(
            "INTENT => SEMESTER"
        );

        return "SEMESTER";
    }

    // ========================================================
    // UNKNOWN
    // ========================================================

    console.log(
        "INTENT => UNKNOWN"
    );

    return "UNKNOWN";
}

// ============================================================
// DEPARTMENT DETECTION
//
// IMPORTANT:
// This function returns an ARRAY.
//
// Examples:
//
// "rooms for cse"
//      -> ["CSE"]
//
// "labs for cse and ece"
//      -> ["CSE", "ECE"]
//
// "rooms for cse and it"
//      -> ["CSE", "IT"]
//
// This prevents "cse ece" from being treated as one value.
// ============================================================

async function detectDepartment(text) {

    const normalized =
        normalizeText(text);

    const possibleDepartments =
        new Set();

    // --------------------------------------------------------
    // Known department abbreviations
    // --------------------------------------------------------

    const knownDepartments = [
        "CSE",
        "ECE",
        "IT",
        "BT",
        "M&C",
        "MC",
        "MED",
        "PMSE",
        "PHYSICS",
        "HSS",
        "CSE & IT"
    ];

    for (
        const dept of knownDepartments
    ) {

        const normalizedDept =
            normalizeText(dept);

        // ----------------------------------------------------
        // M&C
        // ----------------------------------------------------

        if (
            dept === "M&C"
        ) {

            if (
                /\bm\s*(?:&|and)?\s*c\b/i.test(
                    normalized
                )
            ) {

                possibleDepartments.add(
                    dept
                );
            }

            continue;
        }

        // ----------------------------------------------------
        // CSE & IT
        // ----------------------------------------------------

        if (
            dept === "CSE & IT"
        ) {

            if (
                /\bcse\s*(?:&|and)\s*it\b/i.test(
                    normalized
                )
            ) {

                possibleDepartments.add(
                    dept
                );
            }

            continue;
        }

        // ----------------------------------------------------
        // Complete word matching
        //
        // Prevent:
        //
        // "with" -> IT
        //
        // from incorrectly detecting IT.
        // ----------------------------------------------------

        const escapedDept =
            normalizedDept.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const departmentPattern =
            new RegExp(
                `\\b${escapedDept}\\b`,
                "i"
            );

        if (
            departmentPattern.test(
                normalized
            )
        ) {

            possibleDepartments.add(
                dept
            );
        }
    }

    // --------------------------------------------------------
    // Actual database departments
    // --------------------------------------------------------

    if (
        await tableExists(
            "departments"
        )
    ) {

        const columns =
            await getTableColumns(
                "departments"
            );

        const nameColumn =
            findColumn(
                columns,
                [
                    "name",
                    "department_name",
                    "department",
                    "dept_name",
                    "code",
                    "abbreviation"
                ]
            );

        if (nameColumn) {

            const [rows] =
                await db.query(
                    `
                    SELECT ${escapeIdentifier(
                        nameColumn
                    )}
                    FROM departments
                    `
                );

            for (
                const row of rows
            ) {

                const value =
                    row[nameColumn];

                if (!value) {
                    continue;
                }

                const valueNormalized =
                    normalizeText(
                        value
                    );

                if (
                    valueNormalized.length <= 1
                ) {
                    continue;
                }

                const escapedValue =
                    valueNormalized.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    );

                const pattern =
                    new RegExp(
                        `(?:^|\\s)${escapedValue}(?:$|\\s)`,
                        "i"
                    );

                if (
                    pattern.test(
                        normalized
                    )
                ) {

                    possibleDepartments.add(
                        value
                    );
                }
            }
        }
    }

    // --------------------------------------------------------
    // IMPORTANT:
    // Do NOT return only the first department.
    //
    // The old code did:
    //
    // if (cse) return "CSE";
    // if (ece) return "ECE";
    //
    // That broke:
    //
    // "labs for cse and ece"
    //
    // because only CSE was returned.
    // --------------------------------------------------------

    if (
        possibleDepartments.size > 0
    ) {

        return [
            ...possibleDepartments
        ].sort(
            (a, b) =>
                String(a).length -
                String(b).length
        );
    }

    return [];
}

// ============================================================
// NEGATIVE / EXCLUSION HELPERS
// ============================================================

function detectNegativeDepartment(text) {

    const normalized =
        normalizeText(text);

    // Examples:
    //
    // "not in CSE"
    // "not from ECE"
    // "not CSE"
    // "excluding CSE"
    // "except ECE"
    // "other than BT"

    const match =
        normalized.match(
            /\b(?:not|except|excluding|exclude|without|other\s+than)\b\s+(?:(?:in|from|of)\s+)?(cse\s*&\s*it|cse|ece|it|bt|m&c|mc|med|pmse|physics|hss)\b/i
        );

    if (!match) {
        return null;
    }

    const value =
        normalizeText(
            match[1]
        );

    const aliases = {
        "cse": "CSE",
        "cse & it": "CSE & IT",
        "ece": "ECE",
        "it": "IT",
        "bt": "BT",
        "m&c": "M&C",
        "mc": "MC",
        "med": "MED",
        "pmse": "PMSE",
        "physics": "PHYSICS",
        "hss": "HSS"
    };

    return (
        aliases[value] ||
        null
    );
}

// ============================================================
// NEGATIVE ROOM TYPE
//
// Examples:
//
// "not labs"
// "without labs"
// "except labs"
// "excluding labs"
// "but not labs"
// ============================================================

function detectNegativeRoomType(text) {

    const normalized =
        normalizeText(text);

    const match =
        normalized.match(
            /\b(?:not|without|except|excluding)\b\s+(?:a\s+|an\s+|the\s+)?(lab|labs|laboratory|laboratories|practical|practicals|lecture|lectures|lecture\s+room|lecture\s+rooms|classroom|classrooms|tutorial|tutorials|tutorial\s+room|tutorial\s+rooms)\b/i
        );

    if (!match) {
        return null;
    }

    const value =
        match[1];

    if (
        /lab|laboratory|practical/i.test(
            value
        )
    ) {
        return "P";
    }

    if (
        /lecture|classroom/i.test(
            value
        )
    ) {
        return "L";
    }

    if (
        /tutorial/i.test(
            value
        )
    ) {
        return "T";
    }

    return null;
}

// ============================================================
// EXCLUDED SUBJECT
// ============================================================

function detectExcludedSubject(text) {

    const normalized =
        normalizeText(text);

    const match =
        normalized.match(
            /\b(?:except|excluding|exclude|without)\b\s+(.+?)(?:\s+(?:from|in)\s+(?:cse|ece|it|bt|mc|med|pmse|physics|hss)\b|$)/i
        );

    if (!match) {
        return null;
    }

    const value =
        match[1]
            .replace(
                /\b(subject|subjects|course|courses|paper|papers)\b/gi,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    return value || null;
}

// ============================================================
// PROGRAM DETECTION
//
// Database program values:
//
//   B.Tech
//   M.Tech
//
// User may type:
//
//   BTech
//   B Tech
//   B.Tech
//   B. Tech
//   MTech
//   M Tech
//   M.Tech
//   M. Tech
// ============================================================

async function detectProgram(text) {

    const normalized =
        normalizeText(text);

    // --------------------------------------------------------
    // B.TECH
    // --------------------------------------------------------

    if (
        /\bb\s*\.?\s*tech\b/i.test(
            normalized
        )
    ) {

        return "B.Tech";
    }

    // --------------------------------------------------------
    // M.TECH
    // --------------------------------------------------------

    if (
        /\bm\s*\.?\s*tech\b/i.test(
            normalized
        )
    ) {

        return "M.Tech";
    }

    // --------------------------------------------------------
    // INTEGRATED
    // --------------------------------------------------------

    if (
        /\bintegrated\b/i.test(
            normalized
        )
    ) {

        return "Integrated";
    }

    // --------------------------------------------------------
    // DUAL
    // --------------------------------------------------------

    if (
        /\bdual\b/i.test(
            normalized
        )
    ) {

        return "Dual";
    }

    // --------------------------------------------------------
    // DATABASE LOOKUP
    // --------------------------------------------------------

    if (
        await tableExists(
            "programs"
        )
    ) {

        const columns =
            await getTableColumns(
                "programs"
            );

        const nameColumn =
            findColumn(
                columns,
                [
                    "program_name",
                    "name",
                    "program",
                    "code"
                ]
            );

        if (nameColumn) {

            const [rows] =
                await db.query(
                    `
                    SELECT ${escapeIdentifier(
                        nameColumn
                    )}
                    FROM programs
                    `
                );

            for (
                const row of rows
            ) {

                const value =
                    row[nameColumn];

                if (!value) {
                    continue;
                }

                const dbProgram =
                    normalizeText(
                        value
                    );

                const normalizedDbProgram =
                    dbProgram.replace(
                        /[\s.]+/g,
                        ""
                    );

                const normalizedQuery =
                    normalized.replace(
                        /[\s.]+/g,
                        ""
                    );

                if (
                    normalizedQuery.includes(
                        normalizedDbProgram
                    )
                ) {

                    return value;
                }
            }
        }
    }

    return null;
}

// ============================================================
// SEMESTER NUMBER DETECTION
// ============================================================

function detectSemesterNumber(text) {

    const normalized =
        normalizeText(text);

    // "semester 7"

    let match =
        normalized.match(
            /\bsemester\s*(\d{1,2})\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    // "sem 7"

    match =
        normalized.match(
            /\bsem\s*(\d{1,2})\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    // "sem7"

    match =
        normalized.match(
            /\bsem(\d{1,2})\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    // "7th semester"

    match =
        normalized.match(
            /\b(\d{1,2})(?:st|nd|rd|th)?\s*semester\b/i
        );

    if (match) {
        return Number(match[1]);
    }

    return null;
}

// ============================================================
// ROOM TYPE DETECTION
//
// Database values:
//
//   L = Lecture
//   T = Tutorial
//   P = Practical / Lab
// ============================================================

function detectRoomType(text) {

    const normalized =
        normalizeText(text);

    // --------------------------------------------------------
    // PRACTICAL / LAB
    // --------------------------------------------------------

    if (
        /\b(lab|labs|laboratory|laboratories|practical|practicals)\b/i.test(
            normalized
        )
    ) {

        return "P";
    }

    // --------------------------------------------------------
    // LECTURE
    // --------------------------------------------------------

    if (
        /\b(lecture|lectures|lecture\s*room|lecture\s*rooms|classroom|classrooms)\b/i.test(
            normalized
        )
    ) {

        return "L";
    }

    // --------------------------------------------------------
    // TUTORIAL
    // --------------------------------------------------------

    if (
        /\b(tutorial|tutorials|tutorial\s*room|tutorial\s*rooms|tutorial\s*class)\b/i.test(
            normalized
        )
    ) {

        return "T";
    }

    return null;
}

// ============================================================
// CAPACITY FILTER
// ============================================================

function detectCapacityFilter(text) {

    const normalized =
        normalizeText(text);

    // --------------------------------------------------------
    // Above / over / greater than / more than
    // --------------------------------------------------------

    let match =
        normalized.match(
            /\b(?:above|over|greater\s+than|more\s+than)\s*(\d+)\b/i
        );

    if (match) {

        return {
            operator: ">",
            value: Number(match[1])
        };
    }

    // --------------------------------------------------------
    // At least / minimum / min
    // --------------------------------------------------------

    match =
        normalized.match(
            /\b(?:at\s+least|minimum|min)\s*(?:capacity\s*)?(\d+)\b/i
        );

    if (match) {

        return {
            operator: ">=",
            value: Number(match[1])
        };
    }

    // --------------------------------------------------------
    // Below / under / less than
    // --------------------------------------------------------

    match =
        normalized.match(
            /\b(?:below|under|less\s+than)\s*(?:capacity\s*)?(\d+)\b/i
        );

    if (match) {

        return {
            operator: "<",
            value: Number(match[1])
        };
    }

    // --------------------------------------------------------
    // Maximum / max / up to
    // --------------------------------------------------------

    match =
        normalized.match(
            /\b(?:maximum|max|up\s+to)\s*(?:capacity\s*)?(\d+)\b/i
        );

    if (match) {

        return {
            operator: "<=",
            value: Number(match[1])
        };
    }

    // --------------------------------------------------------
    // Exactly / capacity 30
    // --------------------------------------------------------

    match =
        normalized.match(
            /\b(?:capacity\s*(?:of|=)?|exactly)\s*(\d+)\b/i
        );

    if (match) {

        return {
            operator: "=",
            value: Number(match[1])
        };
    }

    return null;
}

// ============================================================
// ROOM ID DETECTION
//
// Examples:
//
// room CL01
// classroom CL01
// lab CL01
// room CR301
// room G-1
// room LT-1
// show CL01
// ============================================================

function detectRoomId(text) {

    const normalized =
        normalizeText(text);

    // --------------------------------------------------------
    // Words that cannot be room IDs
    // --------------------------------------------------------

    const stopWords =
        new Set([
            "with",
            "capacity",
            "more",
            "than",
            "greater",
            "less",
            "above",
            "below",
            "over",
            "under",
            "minimum",
            "maximum",
            "exactly",
            "least",
            "most",
            "up",
            "to",
            "and",
            "or",
            "the",
            "for",
            "in",
            "of",
            "is",
            "are",
            "show",
            "find",
            "get",
            "give",
            "list",
            "display",
            "rooms",
            "room",
            "classroom",
            "classrooms",
            "lab",
            "labs",
            "laboratory",
            "laboratories",
            "lecture",
            "lectures",
            "tutorial",
            "tutorials",
            "practical",
            "practicals"
        ]);

    // --------------------------------------------------------
    // Explicit room / classroom / lab identifier
    // --------------------------------------------------------

    let match =
        normalized.match(
            /\b(?:room|classroom|lab|laboratory)\s+([a-z0-9]+(?:-[a-z0-9]+)?)\b/i
        );

    if (match) {

        const candidate =
            match[1];

        if (
            !stopWords.has(
                candidate.toLowerCase()
            )
        ) {

            const looksLikeRoomId =
                /^[a-z]{1,5}-?\d{1,4}[a-z]?$/i.test(
                    candidate
                );

            if (
                looksLikeRoomId
            ) {

                return candidate;
            }
        }
    }

    // --------------------------------------------------------
    // Room ID appearing without "room"
    // --------------------------------------------------------

    match =
        normalized.match(
            /\b([a-z]{1,5}-?\d{1,4}[a-z]?)\b/i
        );

    if (match) {

        const candidate =
            match[1];

        if (
            !stopWords.has(
                candidate.toLowerCase()
            )
        ) {

            return candidate;
        }
    }

    return null;
}

// ============================================================
// FACULTY ABBREVIATION EXTRACTION
//
// Examples:
//
// faculty with abbreviation JK
// faculty abbreviation JK
// abbreviation of JK
// faculty abbr JK
// short name JK
// short form JK
//
// IMPORTANT:
// The abbreviation is matched separately so that a non-existing
// abbreviation does NOT cause a general faculty query.
// ============================================================

function extractFacultyAbbreviation(text) {

    const normalized =
        normalizeText(text);

    const match =
        normalized.match(
            /\b(?:abbreviation|abbr|short\s+name|short\s+form)\b\s*(?:is|=|:|of|for|with)?\s*([a-z0-9][a-z0-9._-]{1,15})\b/i
        );

    if (!match) {
        return null;
    }

    return match[1].trim();
}

// ============================================================
// FACULTY DETECTION
// ============================================================

function looksLikeSpecificFacultyQuery(text) {

    const normalized =
        normalizeText(text);

    // --------------------------------------------------------
    // IMPORTANT:
    // Abbreviation query must be specific.
    //
    // Example:
    //
    // "faculty with abbreviation JK"
    //
    // must NOT return all faculty if JK doesn't exist.
    // --------------------------------------------------------

    const abbreviation =
        extractFacultyAbbreviation(
            normalized
        );

    if (
        abbreviation
    ) {

        return true;
    }

    // --------------------------------------------------------
    // Email
    // --------------------------------------------------------

    if (
        /\b(email|mail)\b/i.test(
            normalized
        )
    ) {

        return true;
    }

    // --------------------------------------------------------
    // Title
    // --------------------------------------------------------

    if (
        /\b(dr|doctor|prof|professor)\b/i.test(
            normalized
        )
    ) {

        return true;
    }

    // --------------------------------------------------------
    // Details / information / profile
    // --------------------------------------------------------

    if (
        /\b(details|information|info|profile)\b/i.test(
            normalized
        ) &&
        /\b(faculty|teacher|professor)\b/i.test(
            normalized
        )
    ) {

        return true;
    }

    // --------------------------------------------------------
    // Show / find / get / search
    // --------------------------------------------------------

    if (
        /\b(show|find|get|search|give|display)\b/i.test(
            normalized
        )
    ) {

        const ignored = [
            "show",
            "find",
            "get",
            "search",
            "give",
            "display",
            "faculty",
            "teacher",
            "teachers",
            "professor",
            "professors",
            "email",
            "mail",
            "id",
            "of",
            "for",
            "the",
            "details",
            "information",
            "info",
            "profile"
        ];

        const words =
            normalized
                .split(/\s+/)
                .filter(
                    word =>
                        word.length > 2 &&
                        !ignored.includes(
                            word
                        )
                );

        if (
            words.length >= 2
        ) {

            return true;
        }
    }

    return false;
}

// ============================================================
// FIND SPECIFIC FACULTY
// ============================================================

async function findSpecificFaculty(text) {

    const columns =
        await getTableColumns(
            "faculty"
        );

    if (
        columns.length === 0
    ) {

        return {
            found: false,
            specific: false,
            reason:
                "FACULTY_TABLE_NOT_FOUND"
        };
    }

    const nameColumn =
        findColumn(
            columns,
            [
                "name",
                "faculty_name",
                "full_name"
            ]
        );

    const facultyIdColumn =
        findColumn(
            columns,
            [
                "faculty_id",
                "facultyid",
                "employee_id"
            ]
        );

    const abbreviationColumn =
        findColumn(
            columns,
            [
                "abbreviation",
                "abbr",
                "short_name"
            ]
        );

    if (!nameColumn) {

        return {
            found: false,
            specific: false,
            reason:
                "FACULTY_NAME_COLUMN_NOT_FOUND"
        };
    }

    const [rows] =
        await db.query(
            `
            SELECT *
            FROM faculty
            `
        );

    // ========================================================
    // FACULTY ABBREVIATION
    //
    // THIS MUST BE CHECKED FIRST.
    //
    // Example:
    //
    // "faculty with abbreviation JK"
    //
    // If JK exists:
    //     return matching faculty
    //
    // If JK does not exist:
    //     return specific=true
    //     found=false
    //
    // This prevents the system from falling back to all faculty.
    // ========================================================

    const requestedAbbreviation =
        extractFacultyAbbreviation(
            text
        );

    if (
        requestedAbbreviation &&
        abbreviationColumn
    ) {

        const requested =
            normalizeText(
                requestedAbbreviation
            );

        const matchingFaculty =
            rows.find(
                row => {

                    const dbAbbreviation =
                        normalizeText(
                            row[
                                abbreviationColumn
                            ]
                        );

                    return (
                        dbAbbreviation ===
                        requested
                    );
                }
            );

        if (
            matchingFaculty
        ) {

            console.log(
                "FACULTY ABBREVIATION MATCH:",
                requestedAbbreviation
            );

            return {
                found: true,
                specific: true,
                row: matchingFaculty
            };
        }

        console.log(
            "FACULTY ABBREVIATION NOT FOUND:",
            requestedAbbreviation
        );

        return {
            found: false,
            specific: true,
            row: null,
            reason:
                "FACULTY_ABBREVIATION_NOT_FOUND",
            requestedAbbreviation:
                requestedAbbreviation.toUpperCase()
        };
    }

    // ========================================================
    // FULL NAME
    // ========================================================

    const queryName =
        cleanPersonName(
            text
        );

    for (
        const row of rows
    ) {

        const dbName =
            cleanPersonName(
                row[nameColumn]
            );

        if (
            dbName &&
            queryName.includes(
                dbName
            )
        ) {

            return {
                found: true,
                specific: true,
                row
            };
        }
    }

    // ========================================================
    // TOKEN MATCHING
    // ========================================================

    const ignoredWords =
        new Set([
            "email",
            "mail",
            "emailid",
            "id",
            "faculty",
            "teacher",
            "teachers",
            "professor",
            "professors",
            "prof",
            "dr",
            "doctor",
            "details",
            "information",
            "info",
            "profile",
            "show",
            "find",
            "get",
            "give",
            "search",
            "display",
            "of",
            "for",
            "the",
            "please",
            "me",
            "what",
            "is",
            "are",
            "tell"
        ]);

    const queryTokens =
        queryName
            .split(/\s+/)
            .filter(
                token =>
                    token.length > 2 &&
                    !ignoredWords.has(
                        token
                    )
            );

    if (
        queryTokens.length >= 2
    ) {

        const possibleMatches = [];

        for (
            const row of rows
        ) {

            const dbName =
                cleanPersonName(
                    row[nameColumn]
                );

            const dbTokens =
                dbName.split(/\s+/);

            const allMatch =
                queryTokens.every(
                    token =>
                        dbTokens.includes(
                            token
                        )
                );

            if (allMatch) {

                possibleMatches.push(
                    row
                );
            }
        }

        if (
            possibleMatches.length === 1
        ) {

            return {
                found: true,
                specific: true,
                row:
                    possibleMatches[0]
            };
        }
    }

    // ========================================================
    // FACULTY ID
    // ========================================================

    if (
        facultyIdColumn
    ) {

        const idMatch =
            text.match(
                /\b\d{3,8}\b/
            );

        if (idMatch) {

            const id =
                idMatch[0];

            const row =
                rows.find(
                    r =>
                        String(
                            r[
                                facultyIdColumn
                            ]
                        ) === id
                );

            if (row) {

                return {
                    found: true,
                    specific: true,
                    row
                };
            }

            return {
                found: false,
                specific: true,
                row: null,
                reason:
                    "FACULTY_ID_NOT_FOUND",
                requestedFacultyId:
                    id
            };
        }
    }

    // ========================================================
    // LEGACY / DIRECT ABBREVIATION MATCH
    //
    // This remains as a fallback for queries where an
    // abbreviation is directly present but not expressed using
    // "abbreviation", "abbr", "short name", etc.
    //
    // Example:
    //
    // "show JK faculty"
    // ========================================================

    if (
        abbreviationColumn
    ) {

        const words =
            queryName.split(/\s+/);

        for (
            const row of rows
        ) {

            const abbr =
                normalizeText(
                    row[
                        abbreviationColumn
                    ]
                );

            if (
                abbr &&
                words.includes(
                    abbr
                )
            ) {

                return {
                    found: true,
                    specific: true,
                    row
                };
            }
        }
    }

    return {
        found: false,
        specific: true,
        row: null,
        reason:
            "FACULTY_NOT_FOUND"
    };
}

// ============================================================
// FACULTY EMAIL
// ============================================================

async function getFacultyEmail(
    facultyRow
) {

    if (!facultyRow) {
        return null;
    }

    const facultyId =
        getField(
            facultyRow,
            [
                "faculty_id",
                "facultyid",
                "employee_id"
            ]
        );

    // --------------------------------------------------------
    // USERS TABLE
    // --------------------------------------------------------

    if (
        facultyId &&
        await tableExists(
            "users"
        )
    ) {

        const userColumns =
            await getTableColumns(
                "users"
            );

        const userFacultyIdColumn =
            findColumn(
                userColumns,
                [
                    "faculty_id",
                    "facultyid",
                    "employee_id"
                ]
            );

        const emailColumn =
            findColumn(
                userColumns,
                [
                    "email",
                    "mail"
                ]
            );

        if (
            userFacultyIdColumn &&
            emailColumn
        ) {

            const [rows] =
                await db.query(
                    `
                    SELECT ${escapeIdentifier(
                        emailColumn
                    )} AS email
                    FROM users
                    WHERE ${escapeIdentifier(
                        userFacultyIdColumn
                    )} = ?
                    LIMIT 1
                    `,
                    [facultyId]
                );

            if (
                rows.length > 0 &&
                rows[0].email
            ) {

                return rows[0].email;
            }
        }
    }

    // --------------------------------------------------------
    // FALLBACK EMAIL
    // --------------------------------------------------------

    const name =
        getField(
            facultyRow,
            [
                "name",
                "faculty_name",
                "full_name"
            ]
        );

    if (!name) {
        return null;
    }

    const cleanName =
        String(name)
            .replace(
                /\b(Dr|Dr\.|Prof|Prof\.|Professor|Mr|Mr\.|Mrs|Mrs\.|Ms|Ms\.)\b/gi,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    const parts =
        cleanName
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);

    if (
        parts.length === 0
    ) {

        return null;
    }

    return `${parts.join(".")}@mail.jiit.ac.in`;
}

// ============================================================
// FORMAT FACULTY
// ============================================================

async function formatFacultyRow(
    row
) {

    const facultyId =
        getField(
            row,
            [
                "faculty_id",
                "facultyid",
                "employee_id"
            ]
        );

    const name =
        getField(
            row,
            [
                "name",
                "faculty_name",
                "full_name"
            ]
        );

    const abbreviation =
        getField(
            row,
            [
                "abbreviation",
                "abbr",
                "short_name"
            ]
        );

    const department =
        getField(
            row,
            [
                "department",
                "department_name",
                "dept"
            ]
        );

    const email =
        await getFacultyEmail(
            row
        );

    return {
        faculty_id: facultyId,
        name: name,
        abbreviation: abbreviation,
        department: department,
        email: email
    };
}

// ============================================================
// FACULTY QUERY
// ============================================================

async function executeFacultyQuery(
    text
) {

    const columns =
        await getTableColumns(
            "faculty"
        );

    if (
        columns.length === 0
    ) {

        return {
            type: "Faculty",
            count: 0,
            data: [],
            message:
                "Faculty table not found."
        };
    }

    // ========================================================
    // SPECIFIC FACULTY
    // ========================================================

    if (
        looksLikeSpecificFacultyQuery(
            text
        )
    ) {

        const result =
            await findSpecificFaculty(
                text
            );

        if (
            result.specific
        ) {

            if (
                !result.found
            ) {

                // ------------------------------------------------
                // ABBREVIATION NOT FOUND
                // ------------------------------------------------

                if (
                    result.reason ===
                    "FACULTY_ABBREVIATION_NOT_FOUND"
                ) {

                    return {
                        type: "Faculty",
                        count: 0,
                        data: [],
                        message:
                            `No faculty found with abbreviation "${result.requestedAbbreviation}".`
                    };
                }

                // ------------------------------------------------
                // FACULTY ID NOT FOUND
                // ------------------------------------------------

                if (
                    result.reason ===
                    "FACULTY_ID_NOT_FOUND"
                ) {

                    return {
                        type: "Faculty",
                        count: 0,
                        data: [],
                        message:
                            `No faculty found with Faculty ID "${result.requestedFacultyId}".`
                    };
                }

                // ------------------------------------------------
                // GENERAL SPECIFIC FACULTY NOT FOUND
                // ------------------------------------------------

                return {
                    type: "Faculty",
                    count: 0,
                    data: [],
                    message:
                        "No result found. The requested faculty member is not in the database."
                };
            }

            const formatted =
                await formatFacultyRow(
                    result.row
                );

            return {
                type: "Faculty",
                count: 1,
                data: [
                    formatted
                ]
            };
        }
    }

    // ========================================================
    // GENERAL FACULTY QUERY
    // ========================================================

    const departments =
        await detectDepartment(
            text
        );

    const negativeDepartment =
        detectNegativeDepartment(
            text
        );

    const departmentColumn =
        findColumn(
            columns,
            [
                "department",
                "department_name",
                "dept"
            ]
        );

    let sql = `
        SELECT *
        FROM faculty
        WHERE 1 = 1
    `;

    const params = [];

    // ========================================================
    // DEPARTMENT
    // ========================================================

    if (
        departmentColumn &&
        (
            departments.length > 0 ||
            negativeDepartment
        )
    ) {

        if (
            negativeDepartment
        ) {

            const selectedDepartment =
                normalizeText(
                    negativeDepartment
                );

            // "faculty not from CSE"

            if (
                selectedDepartment ===
                "cse"
            ) {

                sql += `
                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)

                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)
                `;

                params.push(
                    "%cse%",
                    "%computer science%"
                );

            } else if (
                selectedDepartment ===
                "it"
            ) {

                sql += `
                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)

                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)
                `;

                params.push(
                    "%it%",
                    "%information technology%"
                );

            } else {

                sql += `
                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)
                `;

                params.push(
                    `%${selectedDepartment}%`
                );
            }

        } else {

            // ====================================================
            // MULTIPLE DEPARTMENTS
            //
            // Example:
            //
            // "faculty for CSE and ECE"
            //
            // becomes:
            //
            // LOWER(department) LIKE LOWER(?)
            // OR
            // LOWER(department) LIKE LOWER(?)
            //
            // params:
            //
            // ["%cse%", "%ece%"]
            // ====================================================

            const departmentConditions =
                [];

            for (
                const dept of departments
            ) {

                const selectedDepartment =
                    normalizeText(
                        dept
                    );

                if (
                    selectedDepartment ===
                    "cse"
                ) {

                    departmentConditions.push(
                        `
                        (
                            LOWER(
                                ${escapeIdentifier(
                                    departmentColumn
                                )}
                            ) = 'cse'

                            OR

                            LOWER(
                                ${escapeIdentifier(
                                    departmentColumn
                                )}
                            ) = 'cse & it'

                            OR

                            LOWER(
                                ${escapeIdentifier(
                                    departmentColumn
                                )}
                            ) LIKE '%computer science%'
                        )
                        `
                    );

                } else if (
                    selectedDepartment ===
                    "it"
                ) {

                    departmentConditions.push(
                        `
                        (
                            LOWER(
                                ${escapeIdentifier(
                                    departmentColumn
                                )}
                            ) = 'it'

                            OR

                            LOWER(
                                ${escapeIdentifier(
                                    departmentColumn
                                )}
                            ) = 'cse & it'

                            OR

                            LOWER(
                                ${escapeIdentifier(
                                    departmentColumn
                                )}
                            ) LIKE '%information technology%'
                        )
                        `
                    );

                } else {

                    departmentConditions.push(
                        `
                        LOWER(
                            ${escapeIdentifier(
                                departmentColumn
                            )}
                        ) LIKE LOWER(?)
                        `
                    );

                    params.push(
                        `%${selectedDepartment}%`
                    );
                }
            }

            if (
                departmentConditions.length > 0
            ) {

                sql += `
                    AND (
                        ${departmentConditions.join(
                            " OR "
                        )}
                    )
                `;
            }
        }
    }

    // ========================================================
    // ORDER BY
    // ========================================================

    const orderColumn =
        findColumn(
            columns,
            [
                "name",
                "faculty_name",
                "full_name"
            ]
        ) ||
        columns[0];

    sql += `
        ORDER BY
        ${escapeIdentifier(
            orderColumn
        )}
    `;

    console.log(
        "FACULTY SQL:",
        sql
    );

    console.log(
        "FACULTY PARAMS:",
        params
    );

    const [rows] =
        await db.query(
            sql,
            params
        );

    const data = [];

    for (
        const row of rows
    ) {

        data.push(
            await formatFacultyRow(
                row
            )
        );
    }

    return {
        type: "Faculty",
        count: data.length,
        data
    };
}

// ============================================================
// ROOM QUERY
//
// ACTUAL ROOM DATA:
//
// room_id
// room_name
// room_type
// department
// capacity
//
// Logical department rule:
//
// User:
//
// "CSE"
//
// Match:
//
// department LIKE "%CSE%"
// OR department = "ALL"
//
// Multiple departments:
//
// "CSE and ECE"
//
// Match:
//
// CSE
// OR ECE
// OR ALL
// ============================================================

async function executeRoomQuery(
    text
) {

    const columns =
        await getTableColumns(
            "rooms"
        );

    if (
        columns.length === 0
    ) {

        return {
            type: "Rooms",
            count: 0,
            data: [],
            message:
                "Rooms table not found."
        };
    }

    // ========================================================
    // ACTUAL COLUMNS
    // ========================================================

    const roomIdColumn =
        findColumn(
            columns,
            [
                "room_id"
            ]
        );

    const roomNameColumn =
        findColumn(
            columns,
            [
                "room_name"
            ]
        );

    const roomTypeColumn =
        findColumn(
            columns,
            [
                "room_type"
            ]
        );

    const departmentColumn =
        findColumn(
            columns,
            [
                "department"
            ]
        );

    const capacityColumn =
        findColumn(
            columns,
            [
                "capacity"
            ]
        );

    let sql = `
        SELECT
            ${escapeIdentifier(
                findColumn(
                    columns,
                    ["id"]
                ) ||
                columns[0]
            )} AS id,

            ${
                roomIdColumn
                    ? escapeIdentifier(
                        roomIdColumn
                    )
                    : "NULL"
            } AS room_id,

            ${
                roomNameColumn
                    ? escapeIdentifier(
                        roomNameColumn
                    )
                    : "NULL"
            } AS room_name,

            ${
                roomTypeColumn
                    ? escapeIdentifier(
                        roomTypeColumn
                    )
                    : "NULL"
            } AS room_type,

            ${
                departmentColumn
                    ? escapeIdentifier(
                        departmentColumn
                    )
                    : "NULL"
            } AS department,

            ${
                capacityColumn
                    ? escapeIdentifier(
                        capacityColumn
                    )
                    : "NULL"
            } AS capacity

        FROM rooms

        WHERE 1 = 1
    `;

    const params = [];

    // ========================================================
    // DEPARTMENT
    // ========================================================

    const departments =
        await detectDepartment(
            text
        );

    const negativeDepartment =
        detectNegativeDepartment(
            text
        );

    if (
        departmentColumn &&
        (
            departments.length > 0 ||
            negativeDepartment
        )
    ) {

        if (
            negativeDepartment
        ) {

            const selectedDepartment =
                normalizeText(
                    negativeDepartment
                );

            // ------------------------------------------------
            // Negative IT
            // ------------------------------------------------

            if (
                selectedDepartment ===
                "it"
            ) {

                sql += `
                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)

                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)
                `;

                params.push(
                    "%it%",
                    "%cse%"
                );

            }

            // ------------------------------------------------
            // Negative CSE
            // ------------------------------------------------

            else if (
                selectedDepartment ===
                "cse"
            ) {

                sql += `
                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)

                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)
                `;

                params.push(
                    "%cse%",
                    "%computer science%"
                );

            }

            // ------------------------------------------------
            // Other negative departments
            // ------------------------------------------------

            else {

                sql += `
                    AND LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) NOT LIKE LOWER(?)
                `;

                params.push(
                    `%${selectedDepartment}%`
                );
            }

        } else {

            // =================================================
            // MULTIPLE DEPARTMENT ROOM SEARCH
            //
            // Example:
            //
            // labs for cse and ece
            //
            // SQL:
            //
            // AND (
            //      CSE condition
            //      OR ECE condition
            //      OR department = 'all'
            // )
            //
            // =================================================

            const departmentConditions =
                [];

            for (
                const dept of departments
            ) {

                const selectedDepartment =
                    normalizeText(
                        dept
                    );

                // ------------------------------------------------
                // CSE
                // ------------------------------------------------

                if (
                    selectedDepartment ===
                    "cse"
                ) {

                    departmentConditions.push(
                        `
                        LOWER(
                            ${escapeIdentifier(
                                departmentColumn
                            )}
                        ) LIKE LOWER(?)
                        `
                    );

                    params.push(
                        "%cse%"
                    );

                    continue;
                }

                // ------------------------------------------------
                // IT
                // ------------------------------------------------

                if (
                    selectedDepartment ===
                    "it"
                ) {

                    departmentConditions.push(
                        `
                        LOWER(
                            ${escapeIdentifier(
                                departmentColumn
                            )}
                        ) LIKE LOWER(?)

                        OR

                        LOWER(
                            ${escapeIdentifier(
                                departmentColumn
                            )}
                        ) LIKE LOWER(?)
                        `
                    );

                    params.push(
                        "%it%",
                        "%cse%"
                    );

                    continue;
                }

                // ------------------------------------------------
                // CSE & IT
                // ------------------------------------------------

                if (
                    selectedDepartment ===
                    "cse & it"
                ) {

                    departmentConditions.push(
                        `
                        LOWER(
                            ${escapeIdentifier(
                                departmentColumn
                            )}
                        ) LIKE LOWER(?)
                        `
                    );

                    params.push(
                        "%cse%"
                    );

                    continue;
                }

                // ------------------------------------------------
                // Other departments
                // ------------------------------------------------

                departmentConditions.push(
                    `
                    LOWER(
                        ${escapeIdentifier(
                            departmentColumn
                        )}
                    ) LIKE LOWER(?)
                    `
                );

                params.push(
                    `%${selectedDepartment}%`
                );
            }

            // ------------------------------------------------
            // General ALL rooms should also be available for
            // department-based room queries.
            // ------------------------------------------------

            departmentConditions.push(
                `
                LOWER(
                    ${escapeIdentifier(
                        departmentColumn
                    )}
                ) = 'all'
                `
            );

            if (
                departmentConditions.length > 0
            ) {

                sql += `
                    AND (
                        ${departmentConditions.join(
                            "\n OR "
                        )}
                    )
                `;
            }
        }
    }

    // ========================================================
    // ROOM TYPE
    // ========================================================

    const roomType =
        detectRoomType(
            text
        );

    const negativeRoomType =
        detectNegativeRoomType(
            text
        );

    console.log(
        "ROOM TYPE:",
        roomType
    );

    console.log(
        "NEGATIVE ROOM TYPE:",
        negativeRoomType
    );

    // ========================================================
    // NEGATIVE ROOM TYPE HAS PRIORITY
    //
    // Example:
    //
    // "rooms for cse but not labs"
    //
    // detectRoomType()       -> P
    // detectNegativeRoomType -> P
    //
    // We use:
    //
    // room_type <> 'P'
    //
    // rather than:
    //
    // room_type = 'P'
    // ========================================================

    if (
        negativeRoomType &&
        roomTypeColumn
    ) {

        sql += `
            AND ${escapeIdentifier(
                roomTypeColumn
            )} <> ?
        `;

        params.push(
            negativeRoomType
        );

    } else if (
        roomType &&
        roomTypeColumn
    ) {

        sql += `
            AND ${escapeIdentifier(
                roomTypeColumn
            )} = ?
        `;

        params.push(
            roomType
        );
    }

    // ========================================================
    // CAPACITY
    // ========================================================

    const capacityFilter =
        detectCapacityFilter(
            text
        );

    console.log(
        "CAPACITY FILTER:",
        capacityFilter
    );

    if (
        capacityFilter &&
        capacityColumn
    ) {

        sql += `
            AND ${escapeIdentifier(
                capacityColumn
            )}
            ${capacityFilter.operator}
            ?
        `;

        params.push(
            capacityFilter.value
        );
    }

    // ========================================================
    // SPECIFIC ROOM
    // ========================================================

    const roomId =
        detectRoomId(
            text
        );

    console.log(
        "ROOM ID:",
        roomId
    );

    if (
        roomId &&
        roomIdColumn
    ) {

        sql += `
            AND (
                LOWER(
                    ${escapeIdentifier(
                        roomIdColumn
                    )}
                ) = LOWER(?)

                OR

                LOWER(
                    ${escapeIdentifier(
                        roomNameColumn ||
                        roomIdColumn
                    )}
                ) = LOWER(?)
            )
        `;

        params.push(
            roomId,
            roomId
        );
    }

    // ========================================================
    // ORDER BY
    // ========================================================

    if (
        capacityColumn
    ) {

        sql += `
            ORDER BY
            ${escapeIdentifier(
                capacityColumn
            )} DESC
        `;

    } else if (
        roomIdColumn
    ) {

        sql += `
            ORDER BY
            ${escapeIdentifier(
                roomIdColumn
            )}
        `;
    }

    // ========================================================
    // DEBUG LOGS
    // ========================================================

    console.log(
        "======================================"
    );

    console.log(
        "ROOM QUERY"
    );

    console.log(
        "======================================"
    );

    console.log(
        "Original:",
        text
    );

    console.log(
        "Department:",
        departments
    );

    console.log(
        "Negative Department:",
        negativeDepartment
    );

    console.log(
        "Room Type:",
        roomType
    );

    console.log(
        "Negative Room Type:",
        negativeRoomType
    );

    console.log(
        "Capacity:",
        capacityFilter
    );

    console.log(
        "Room ID:",
        roomId
    );

    console.log(
        "ROOM SQL:",
        sql
    );

    console.log(
        "ROOM PARAMS:",
        params
    );

    // ========================================================
    // EXECUTE
    // ========================================================

    const [rows] =
        await db.query(
            sql,
            params
        );

    console.log(
        "ROOM RESULT COUNT:",
        rows.length
    );

    return {
        type: "Rooms",
        count: rows.length,
        data: rows,
        message:
            rows.length === 0
                ? "No result found."
                : undefined
    };
}

// ============================================================
// SUBJECT QUERY
// ============================================================

async function executeSubjectQuery(
    text
) {

    const columns =
        await getTableColumns(
            "subjects"
        );

    if (
        columns.length === 0
    ) {

        return {
            type: "Subjects",
            count: 0,
            data: [],
            message:
                "Subjects table not found."
        };
    }

    const codeColumn =
        findColumn(
            columns,
            [
                "course_code",
                "subject_code",
                "code"
            ]
        );

    const nameColumn =
        findColumn(
            columns,
            [
                "subject_name",
                "course_name",
                "name",
                "title"
            ]
        );

    // ========================================================
    // ENTITIES
    // ========================================================

    const departments =
        await detectDepartment(
            text
        );

    const negativeDepartment =
        detectNegativeDepartment(
            text
        );

    const program =
        await detectProgram(
            text
        );

    const semester =
        detectSemesterNumber(
            text
        );

    console.log(
        "SUBJECT QUERY"
    );

    console.log(
        "Department:",
        departments
    );

    console.log(
        "Program:",
        program
    );

    console.log(
        "Semester:",
        semester
    );

    // ========================================================
    // SQL
    // ========================================================

    let sql = `
        SELECT

            s.id,

            s.course_code,

            s.subject_name,

            s.course_type,

            s.elective_group,

            s.lecture_hours,

            s.tutorial_hours,

            s.practical_hours,

            s.credits,

            p.program_name AS program,

            d.name AS department,

            d.abbreviation AS department_code,

            sem.semester_number AS semester,

            sem.semester_name

        FROM subjects s

        INNER JOIN programs p
            ON s.program_id = p.id

        INNER JOIN departments d
            ON s.department_id = d.id

        INNER JOIN semesters sem
            ON s.semester_id = sem.id

        WHERE s.is_active = 1
    `;

    const params = [];

    // ========================================================
    // DEPARTMENT
    // ========================================================

    if (
        negativeDepartment
    ) {

        sql += `
            AND LOWER(
                d.abbreviation
            ) <> LOWER(?)

            AND LOWER(
                d.name
            ) NOT LIKE LOWER(?)
        `;

        params.push(
            negativeDepartment,
            `%${negativeDepartment}%`
        );

    } else if (
        departments.length > 0
    ) {

        const departmentConditions =
            [];

        for (
            const dept of departments
        ) {

            departmentConditions.push(
                `
                (
                    LOWER(
                        d.abbreviation
                    ) = LOWER(?)

                    OR

                    LOWER(
                        d.name
                    ) = LOWER(?)

                    OR

                    LOWER(
                        d.name
                    ) LIKE LOWER(?)
                )
                `
            );

            params.push(
                dept,
                dept,
                `%${dept}%`
            );
        }

        sql += `
            AND (
                ${departmentConditions.join(
                    " OR "
                )}
            )
        `;
    }

    // ========================================================
    // SEMESTER
    // ========================================================

    if (
        semester !== null
    ) {

        sql += `
            AND sem.semester_number = ?
        `;

        params.push(
            semester
        );
    }

    // ========================================================
    // PROGRAM
    // ========================================================

    if (
        program
    ) {

        sql += `
            AND (
                LOWER(
                    p.program_name
                ) = LOWER(?)

                OR

                LOWER(
                    p.program_name
                ) LIKE LOWER(?)
            )
        `;

        params.push(
            program,
            `%${program}%`
        );
    }

    // ========================================================
    // SUBJECT EXCLUSION
    // ========================================================

    const excludedSubject =
        detectExcludedSubject(
            text
        );

    if (
        excludedSubject &&
        nameColumn
    ) {

        sql += `
            AND LOWER(
                s.${escapeIdentifier(
                    nameColumn
                )}
            ) NOT LIKE LOWER(?)
        `;

        params.push(
            `%${excludedSubject}%`
        );
    }

    // ========================================================
    // SPECIFIC SUBJECT SEARCH
    // ========================================================

    const genericWords =
        new Set([
            "show",
            "find",
            "get",
            "give",
            "list",
            "display",
            "what",
            "are",
            "the",

            "subject",
            "subjects",
            "course",
            "courses",
            "paper",
            "papers",

            "for",
            "of",
            "in",
            "from",
            "not",
            "except",
            "excluding",
            "exclude",
            "without",
            "other",
            "than",

            "semester",
            "sem",

            "program",
            "department",

            "btech",
            "mtech",
            "integrated",
            "dual",

            "cse",
            "ece",
            "it",
            "bt",
            "mc",
            "med",

            "subejct",
            "subjet",
            "subj"
        ]);

    const searchTokens =
        normalizeText(text)
            .split(/\s+/)
            .filter(
                word =>
                    word.length > 2 &&
                    !genericWords.has(
                        word
                    ) &&
                    !/^\d+$/.test(word)
            );

    if (
        searchTokens.length >= 2 &&
        departments.length === 0 &&
        !program &&
        semester === null
    ) {

        const searchText =
            `%${searchTokens.join(" ")}%`;

        const conditions = [];

        if (
            nameColumn
        ) {

            conditions.push(
                `
                LOWER(
                    s.${escapeIdentifier(
                        nameColumn
                    )}
                ) LIKE LOWER(?)
                `
            );
        }

        if (
            codeColumn
        ) {

            conditions.push(
                `
                LOWER(
                    s.${escapeIdentifier(
                        codeColumn
                    )}
                ) LIKE LOWER(?)
                `
            );
        }

        if (
            conditions.length > 0
        ) {

            sql += `
                AND (
                    ${conditions.join(
                        " OR "
                    )}
                )
            `;

            for (
                let i = 0;
                i < conditions.length;
                i++
            ) {

                params.push(
                    searchText
                );
            }
        }
    }

    // ========================================================
    // ORDER
    // ========================================================

    sql += `
        ORDER BY s.course_code
    `;

    console.log(
        "SUBJECT SQL:"
    );

    console.log(
        sql
    );

    console.log(
        "SUBJECT PARAMS:"
    );

    console.log(
        params
    );

    const [rows] =
        await db.query(
            sql,
            params
        );

    console.log(
        "SUBJECT RESULT COUNT:",
        rows.length
    );

    return {
        type: "Subjects",
        count: rows.length,
        data: rows,
        message:
            rows.length === 0
                ? "No result found."
                : undefined
    };
}

// ============================================================
// SEMESTER QUERY
// ============================================================

async function executeSemesterQuery(
    text
) {

    const columns =
        await getTableColumns(
            "semesters"
        );

    if (
        columns.length === 0
    ) {

        return {
            type: "Semesters",
            count: 0,
            data: [],
            message:
                "Semesters table not found."
        };
    }

    const semesterColumn =
        findColumn(
            columns,
            [
                "semester",
                "semester_number",
                "sem",
                "semester_id"
            ]
        );

    const programColumn =
        findColumn(
            columns,
            [
                "program",
                "program_name",
                "program_code"
            ]
        );

    const departmentColumn =
        findColumn(
            columns,
            [
                "department",
                "department_name",
                "dept"
            ]
        );

    let sql = `
        SELECT *
        FROM semesters
        WHERE 1 = 1
    `;

    const params = [];

    // ========================================================
    // SEMESTER
    // ========================================================

    const semester =
        detectSemesterNumber(
            text
        );

    if (
        semester !== null &&
        semesterColumn
    ) {

        sql += `
            AND CAST(
                ${escapeIdentifier(
                    semesterColumn
                )}
                AS CHAR
            ) = ?
        `;

        params.push(
            String(semester)
        );
    }

    // ========================================================
    // PROGRAM
    // ========================================================

    const program =
        await detectProgram(
            text
        );

    if (
        program &&
        programColumn
    ) {

        sql += `
            AND LOWER(
                ${escapeIdentifier(
                    programColumn
                )}
            ) LIKE LOWER(?)
        `;

        params.push(
            `%${program}%`
        );
    }

    // ========================================================
    // DEPARTMENT
    // ========================================================

    const departments =
        await detectDepartment(
            text
        );

    if (
        departments.length > 0 &&
        departmentColumn
    ) {

        const departmentConditions =
            [];

        for (
            const dept of departments
        ) {

            departmentConditions.push(
                `
                LOWER(
                    ${escapeIdentifier(
                        departmentColumn
                    )}
                ) LIKE LOWER(?)
                `
            );

            params.push(
                `%${dept}%`
            );
        }

        sql += `
            AND (
                ${departmentConditions.join(
                    " OR "
                )}
            )
        `;
    }

    // ========================================================
    // ORDER
    // ========================================================

    sql += `
        ORDER BY ${
            semesterColumn
                ? escapeIdentifier(
                    semesterColumn
                )
                : escapeIdentifier(
                    columns[0]
                )
        }
    `;

    const [rows] =
        await db.query(
            sql,
            params
        );

    return {
        type: "Semesters",
        count: rows.length,
        data: rows,
        message:
            rows.length === 0
                ? "No result found."
                : undefined
    };
}

// ============================================================
// MAIN QUERY EXECUTOR
// ============================================================

async function executeQuery(
    userQuery
) {

    if (
        !userQuery ||
        !String(userQuery).trim()
    ) {

        return {
            type: "Unknown",
            count: 0,
            data: [],
            message:
                "Please enter a query."
        };
    }

    const text =
        normalizeText(
            userQuery
        );

    console.log("");

    console.log(
        "======================================"
    );

    console.log(
        "NATURAL LANGUAGE QUERY"
    );

    console.log(
        "======================================"
    );

    console.log(
        "Original:",
        userQuery
    );

    console.log(
        "Normalized:",
        text
    );

    try {

        // ====================================================
        // INTENT
        // ====================================================

        const intent =
            detectIntent(
                text
            );

        console.log(
            "Detected intent:",
            intent
        );

        // ====================================================
        // FACULTY
        // ====================================================

        if (
            intent === "FACULTY"
        ) {

            const result =
                await executeFacultyQuery(
                    text
                );

            console.log(
                "Faculty results:",
                result.count
            );

            return result;
        }

        // ====================================================
        // ROOM
        // ====================================================

        if (
            intent === "ROOM"
        ) {

            const result =
                await executeRoomQuery(
                    text
                );

            console.log(
                "Room results:",
                result.count
            );

            return result;
        }

        // ====================================================
        // SUBJECT
        // ====================================================

        if (
            intent === "SUBJECT"
        ) {

            const result =
                await executeSubjectQuery(
                    text
                );

            console.log(
                "Subject results:",
                result.count
            );

            return result;
        }

        // ====================================================
        // SEMESTER
        // ====================================================

        if (
            intent === "SEMESTER"
        ) {

            const result =
                await executeSemesterQuery(
                    text
                );

            console.log(
                "Semester results:",
                result.count
            );

            return result;
        }

        // ====================================================
        // UNKNOWN
        // ====================================================

        return {
            type: "Unknown",
            count: 0,
            data: [],
            message:
                "I could not understand the query. Try asking about faculty, rooms, subjects, or semesters."
        };

    } catch (error) {

        console.error(
            "QUERY SERVICE ERROR:",
            error
        );

        throw error;
    }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    executeQuery
};