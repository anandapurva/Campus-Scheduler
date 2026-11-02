
"use strict";

const db = require("../config/db");

// ============================================================
// CAMPUS SCHEDULER - COMPLETE NATURAL LANGUAGE QUERY SERVICE
//
// SUPPORTED:
// FACULTY
// ROOM
// SUBJECT
// SEMESTER
// BATCH
// ACADEMIC_SESSION
// TIMETABLE
// TIMETABLE_CONFIGURATION
// FREE_SLOTS
//
// ============================================================


// ============================================================
// 1. GENERAL HELPERS
// ============================================================

const schemaCache = {};

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[?.,!;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeIdentifier(value) {
    return "`" + String(value).replace(/`/g, "``") + "`";
}

function findColumn(columns, candidates) {
    for (const candidate of candidates) {
        const found = columns.find(
            col => col.toLowerCase() === candidate.toLowerCase()
        );
        if (found) return found;
    }
    return null;
}

function addCondition(state, condition, values = []) {
    state.conditions.push(condition);
    state.params.push(...values);
}

function buildWhere(state) {
    return state.conditions.length
        ? " WHERE " + state.conditions.join(" AND ")
        : "";
}

function makeResult(type, rows, message) {
    return {
        type,
        count: rows.length,
        data: rows,
        ...(rows.length === 0
            ? { message: message || "No result found." }
            : {})
    };
}

async function getTableColumns(table) {
    if (schemaCache[table]) return schemaCache[table];

    const [rows] = await db.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [table]
    );

    schemaCache[table] = rows.map(row => row.COLUMN_NAME);

    return schemaCache[table];
}

async function tableExists(table) {
    return (await getTableColumns(table)).length > 0;
}

async function requireTables(tables) {
    for (const table of tables) {
        if (!await tableExists(table)) {
            throw new Error(`Required table not found: ${table}`);
        }
    }
}


// ============================================================
// 2. INTENT DETECTION
// ============================================================

function detectIntent(text) {
    const t = normalizeText(text);

    // Free slot queries must be checked before timetable.
    if (
        /\b(free|available|availability|vacant|idle|gap|gaps)\b/i.test(t)
    ) {
        return "FREE_SLOTS";
    }

    if (/\b(subject|subjects|course|courses|paper|papers|subj)\b/i.test(t)) {
        return "SUBJECT";
    }

    if (
        /\b(timetable|time table|class schedule|class timings|lecture schedule|daily schedule|weekly schedule|my classes|scheduled classes)\b/i.test(t)
    ) {
        return "TIMETABLE";
    }

    if (
        /\b(lunch timing|lunch timings|lunch break|timetable configuration|schedule configuration|timetable settings)\b/i.test(t)
    ) {
        return "TIMETABLE_CONFIGURATION";
    }

    if (
        /\b(academic session|academic sessions|academic year|active session|current session)\b/i.test(t)
    ) {
        return "ACADEMIC_SESSION";
    }

    if (/\b(batch|batches|batch code|batch details)\b/i.test(t)) {
        return "BATCH";
    }

    if (/\b(room|rooms|classroom|classrooms|lab|labs|laboratory)\b/i.test(t)) {
        return "ROOM";
    }

    if (
        /\b(faculty|faculties|teacher|teachers|professor|professors|lecturer|lecturers|email|mail)\b/i.test(t)
    ) {
        return "FACULTY";
    }

    if (/\b(semester|sem|semesters)\b|\bsem\d+\b/i.test(t)) {
        return "SEMESTER";
    }

    return "UNKNOWN";
}


// ============================================================
// 3. ENTITY DETECTION
// ============================================================

const KNOWN_DEPARTMENTS = [
    "CSE", "ECE", "IT", "BT", "M&C",
    "MC", "MED", "PMSE", "PHYSICS", "HSS"
];

async function detectDepartment(text) {
    const t = normalizeText(text);
    const found = new Set();

    function matchesDepartment(value) {
        if (!value) return false;

        const normalized = normalizeText(value);

        if (normalized.length < 2) return false;

        // Match complete words/phrases, not substrings.
        const escaped = normalized
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\s+/g, "\\s+");

        return new RegExp(
            `(^|\\s)${escaped}(?=\\s|$)`,
            "i"
        ).test(t);
    }

    for (const dept of KNOWN_DEPARTMENTS) {
        if (matchesDepartment(dept)) {
            found.add(dept);
        }
    }

    if (await tableExists("departments")) {
        const columns = await getTableColumns("departments");

        const nameCol = findColumn(columns, ["name"]);
        const abbrCol = findColumn(columns, ["abbreviation"]);

        if (nameCol || abbrCol) {
            const [rows] = await db.execute(
                "SELECT * FROM departments"
            );

            for (const row of rows) {
                for (const col of [nameCol, abbrCol]) {
                    if (!col || !row[col]) continue;

                    if (matchesDepartment(row[col])) {
                        found.add(row[col]);
                    }
                }
            }
        }
    }

    return [...found];
}

function detectNegativeDepartment(text) {
    const match = normalizeText(text).match(
        /\b(?:not|except|excluding|exclude|without|other than)\b\s+(?:(?:in|from|of)\s+)?(cse\s*&\s*it|cse|ece|it|bt|m&c|mc|med|pmse|physics|hss)\b/i
    );

    return match ? match[1].toUpperCase() : null;
}

async function detectProgram(text) {
    const t = normalizeText(text);

    if (/\bb\s*\.?\s*tech\b|\bbtech\b/i.test(t)) return "BTECH";
    if (/\bm\s*\.?\s*tech\b|\bmtech\b/i.test(t)) return "MTECH";
    if (/\bintegrated\b/i.test(t)) return "INTEGRATED";
    if (/\bdual\b/i.test(t)) return "DUAL";

    if (await tableExists("programs")) {
        const columns = await getTableColumns("programs");
        const nameCol = findColumn(columns, ["program_name"]);

        if (nameCol) {
            const [rows] = await db.execute(
                `SELECT ${escapeIdentifier(nameCol)} AS program_name FROM programs`
            );

            for (const row of rows) {
                if (t.includes(normalizeText(row.program_name))) {
                    return row.program_name;
                }
            }
        }
    }

    return null;
}

function detectSemesterNumber(text) {
    const t = normalizeText(text);

    const patterns = [
        /\bsemester\s*(\d{1,2})\b/,
        /\bsem\s*(\d{1,2})\b/,
        /\bsem(\d{1,2})\b/,
        /\b(\d{1,2})(?:st|nd|rd|th)?\s*semester\b/
    ];

    for (const pattern of patterns) {
        const match = t.match(pattern);

        if (match) {
            const n = Number(match[1]);
            if (n >= 1 && n <= 20) return n;
        }
    }

    const words = {
        first: 1, second: 2, third: 3,
        fourth: 4, fifth: 5, sixth: 6,
        seventh: 7, eighth: 8, ninth: 9,
        tenth: 10
    };

    for (const [word, number] of Object.entries(words)) {
        if (new RegExp(`\\b${word}\\s+(?:semester|sem)\\b`, "i").test(t)) {
            return number;
        }
    }

    return null;
}

function detectDay(text) {
    const days = {
        monday: "Monday", mon: "Monday",
        tuesday: "Tuesday", tue: "Tuesday", tues: "Tuesday",
        wednesday: "Wednesday", wed: "Wednesday",
        thursday: "Thursday", thu: "Thursday", thurs: "Thursday",
        friday: "Friday", fri: "Friday",
        saturday: "Saturday", sat: "Saturday",
        sunday: "Sunday", sun: "Sunday"
    };

    const t = normalizeText(text);

    for (const [key, value] of Object.entries(days)) {
        if (new RegExp(`\\b${key}\\b`, "i").test(t)) {
            return value;
        }
    }

    return null;
}

function detectAcademicYear(text) {
    const t = normalizeText(text);

    let match = t.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);

    if (match) {
        return {
            startYear: Number(match[1]),
            endYear: Number(match[2])
        };
    }

    match = t.match(/\b(20\d{2})\b/);

    return match
        ? { startYear: Number(match[1]), endYear: Number(match[1]) + 1 }
        : null;
}

function detectBatchCode(text) {
    if (!text) return null;

    const input = String(text).trim();

    // Ignore common words that are not batch codes.
    const ignored = new Set([
        "batch",
        "code",
        "semester",
        "sem",
        "timetable",
        "schedule",
        "free",
        "available",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ]);

    // First detect an actual batch-like code anywhere.
    const matches = input.match(
        /\b[A-Z]\d{1,3}[A-Z0-9_-]*|\d+[A-Z]\d{0,3}\b/gi
    ) || [];

    for (const match of matches) {
        if (!ignored.has(match.toLowerCase())) {
            return match.toUpperCase();
        }
    }

    // Support batch codes with other formats after "batch".
    const explicit = input.match(
        /\bbatch\s+(?:code\s+)?([a-z0-9][a-z0-9_-]*)\b/i
    );

    if (
        explicit &&
        !ignored.has(explicit[1].toLowerCase())
    ) {
        return explicit[1].toUpperCase();
    }

    return null;
}

function detectRoomType(text) {
    const t = normalizeText(text);

    if (/\b(lab|labs|laboratory|practical)\b/i.test(t)) return "P";
    if (/\b(lecture|classroom)\b/i.test(t)) return "L";
    if (/\b(tutorial)\b/i.test(t)) return "T";

    return null;
}

function detectCapacityFilter(text) {
    const t = normalizeText(text);

    const patterns = [
        { regex: /\b(?:above|over|greater than|more than)\s*(\d+)\b/i, op: ">" },
        { regex: /\b(?:at least|minimum|min)\s*(?:capacity\s*)?(\d+)\b/i, op: ">=" },
        { regex: /\b(?:below|under|less than)\s*(?:capacity\s*)?(\d+)\b/i, op: "<" },
        { regex: /\b(?:maximum|max|up to)\s*(?:capacity\s*)?(\d+)\b/i, op: "<=" },
        { regex: /\b(?:capacity\s*(?:of|=)?|exactly)\s*(\d+)\b/i, op: "=" }
    ];

    for (const item of patterns) {
        const match = t.match(item.regex);

        if (match) {
            return {
                operator: item.op,
                value: Number(match[1])
            };
        }
    }

    return null;
}

function detectRoomId(text) {
    const match = normalizeText(text).match(
        /\b(?:room|classroom|lab|laboratory)\s+([a-z]{1,5}-?\d{1,4}[a-z]?)\b/i
    );

    return match ? match[1].toUpperCase() : null;
}

function extractFacultyAbbreviation(text) {
    const normalized = normalizeText(text);

    const match = normalized.match(
        /\b(?:abbreviation|abbr|short name|short form)\s*(?:is|of|for|with|=)?\s*([a-z0-9][a-z0-9._-]{1,15})\b/i
    );

    if (!match) return null;

    return match[1].toUpperCase();
}

function parseTimetableFilters(text) {
    return {
        batchCode: detectBatchCode(text),
        semester: detectSemesterNumber(text),
        day: detectDay(text),
        enrollmentYear: (() => {
            const year = detectAcademicYear(text);
            return year ? year.startYear : null;
        })()
    };
}


// ============================================================
// 4. FACULTY QUERY
// ============================================================

async function executeFacultyQuery(text) {
    await requireTables(["faculty"]);

    const columns = await getTableColumns("faculty");

    const nameCol = findColumn(columns, ["name"]);
    const deptCol = findColumn(columns, ["department"]);
    const abbrCol = findColumn(columns, ["abbreviation"]);
    const idCol = findColumn(columns, ["faculty_id", "id"]);

    if (!nameCol) throw new Error("faculty.name column not found.");

    const departments = await detectDepartment(text);
    const negative = detectNegativeDepartment(text);

    const state = { conditions: [], params: [] };

    const abbreviation = extractFacultyAbbreviation(text);

    if (abbreviation && abbrCol) {
        addCondition(
            state,
            `LOWER(f.${escapeIdentifier(abbrCol)}) = LOWER(?)`,
            [abbreviation]
        );
    }

    const idMatch = String(text).match(/\b\d{3,8}\b/);

    if (idMatch && idCol) {
        addCondition(
            state,
            `f.${escapeIdentifier(idCol)} = ?`,
            [idMatch[0]]
        );
    }

    const ignored = new Set([
        "faculty", "faculties", "teacher", "teachers",
        "professor", "professors", "lecturer", "lecturers",
        "show", "find", "get", "give", "list", "display",
        "email", "mail", "details", "information", "profile",
        "please", "what", "who", "is", "are", "the", "of", "for",
        "all", "cse", "ece", "it", "bt", "mc", "med", "pmse",
        "physics", "hss"
    ]);

    const tokens = normalizeText(text)
        .split(/\s+/)
        .filter(word => word.length > 2 && !ignored.has(word));

    if (tokens.length && !departments.length &&
        !abbreviation && !idMatch) {
        addCondition(
            state,
            `LOWER(f.${escapeIdentifier(nameCol)}) LIKE LOWER(?)`,
            [`%${tokens.join(" ")}%`]
        );
    }

    if (departments.length && deptCol && !negative) {
        addCondition(
            state,
            `LOWER(f.${escapeIdentifier(deptCol)}) LIKE LOWER(?)`,
            [`%${departments[0]}%`]
        );
    }

    if (negative && deptCol) {
        addCondition(
            state,
            `LOWER(f.${escapeIdentifier(deptCol)}) NOT LIKE LOWER(?)`,
            [`%${negative}%`]
        );
    }

    let emailJoin = "";

    if (await tableExists("users") && idCol) {
        const userColumns = await getTableColumns("users");

        if (userColumns.includes("faculty_id") &&
            userColumns.includes("email")) {
            emailJoin = `
                LEFT JOIN users u
                ON u.faculty_id = f.${escapeIdentifier(idCol)}
                AND u.role = 'TEACHER'
            `;
        }
    }

    const sql = `
        SELECT f.*,
        ${emailJoin ? "u.email" : "NULL AS email"}
        FROM faculty f
        ${emailJoin}
        ${buildWhere(state)}
        ORDER BY f.${escapeIdentifier(nameCol)}
    `;
console.log("FINAL SQL:", sql);
console.log("SQL PARAMS:", state.params);
    const [rows] = await db.execute(sql, state.params);
    

    return makeResult("Faculty", rows);
}


// ============================================================
// 5. ROOM QUERY
// ============================================================

async function executeRoomQuery(text) {
    await requireTables(["rooms"]);

    const state = { conditions: [], params: [] };

    const columns = await getTableColumns("rooms");

    const roomIdCol = findColumn(columns, ["room_id"]);
    const roomNameCol = findColumn(columns, ["room_name"]);
    const typeCol = findColumn(columns, ["room_type"]);
    const deptCol = findColumn(columns, ["department"]);
    const capacityCol = findColumn(columns, ["capacity"]);

    const departments = await detectDepartment(text);
    const negative = detectNegativeDepartment(text);

    if (departments.length && deptCol && !negative) {
        const conditions = departments.map(
            () => `LOWER(${escapeIdentifier(deptCol)}) LIKE LOWER(?)`
        );

        const values = departments.map(d => `%${d}%`);

        conditions.push(`LOWER(${escapeIdentifier(deptCol)}) = 'all'`);

        addCondition(state, `(${conditions.join(" OR ")})`, values);
    }

    if (negative && deptCol) {
        addCondition(
            state,
            `LOWER(${escapeIdentifier(deptCol)}) NOT LIKE LOWER(?)`,
            [`%${negative}%`]
        );
    }

    const type = detectRoomType(text);
    const capacity = detectCapacityFilter(text);
    const roomId = detectRoomId(text);

    if (type && typeCol) {
        addCondition(
            state,
            `${escapeIdentifier(typeCol)} = ?`,
            [type]
        );
    }

    if (capacity && capacityCol) {
        addCondition(
            state,
            `${escapeIdentifier(capacityCol)} ${capacity.operator} ?`,
            [capacity.value]
        );
    }

    if (roomId && roomIdCol && roomNameCol) {
        addCondition(
            state,
            `(LOWER(${escapeIdentifier(roomIdCol)}) = LOWER(?) OR LOWER(${escapeIdentifier(roomNameCol)}) = LOWER(?))`,
            [roomId, roomId]
        );
    }

    const [rows] = await db.execute(
        `SELECT * FROM rooms
         ${buildWhere(state)}
         ORDER BY ${capacityCol ? escapeIdentifier(capacityCol) + " DESC," : ""}
         ${roomIdCol ? escapeIdentifier(roomIdCol) : "id"}`,
        state.params
    );

    return makeResult("Rooms", rows);
}


// ============================================================
// 6. SUBJECT QUERY
// ============================================================


async function executeSubjectQuery(text) {
    await requireTables([
        "subjects",
        "programs",
        "departments",
        "semesters"
    ]);

    const departments = await detectDepartment(text);
    const program = await detectProgram(text);
    const semester = detectSemesterNumber(text);

    const normalizedText = normalizeText(text);

    // Detect whether the user wants common/shared subjects.
    const commonSubjects =
        /\b(common|shared|both|mutual)\b/i.test(normalizedText);

    const state = {
        conditions: ["s.is_active = 1"],
        params: []
    };

    // Department filtering
    if (departments.length) {
        const conditions = [];

        for (const dept of departments) {
            conditions.push(`
                (
                    UPPER(d.abbreviation) = UPPER(?)
                    OR UPPER(d.name) LIKE UPPER(?)
                )
            `);

            state.params.push(dept, `%${dept}%`);
        }

        addCondition(
            state,
            `(${conditions.join(" OR ")})`
        );
    }

    // Program filtering
    if (program) {
        addCondition(
            state,
            "LOWER(p.program_name) LIKE LOWER(?)",
            [`%${program}%`]
        );
    }

    // Semester filtering
    if (semester !== null) {
        addCondition(
            state,
            "sem.semester_number = ?",
            [semester]
        );
    }

    // Common subjects require at least two departments.
    if (commonSubjects && departments.length < 2) {
        return makeResult(
            "Subjects",
            [],
            "Please mention at least two departments to find common subjects."
        );
    }

    // Common-subject query
    let commonHaving = "";

    if (commonSubjects) {
        commonHaving = `
            HAVING COUNT(DISTINCT d.id) = ?
        `;

        state.params.push(departments.length);
    }

    const sql = `
        SELECT
            s.id,

            s.course_code AS subject_code,
            s.course_code,

            s.subject_name,
            s.course_type,

            s.elective_group,

            s.lecture_hours,
            s.tutorial_hours,
            s.practical_hours,
            s.credits,

            p.program_name AS program,

            GROUP_CONCAT(
                DISTINCT d.abbreviation
                ORDER BY d.abbreviation
                SEPARATOR ', '
            ) AS department_code,

            GROUP_CONCAT(
                DISTINCT d.name
                ORDER BY d.name
                SEPARATOR ', '
            ) AS department,

            sem.id AS semester_id,
            sem.semester_number AS semester,
            sem.semester_name,
            sem.year AS semester_year

        FROM subjects s

        INNER JOIN programs p
            ON p.id = s.program_id

        INNER JOIN departments d
            ON d.id = s.department_id

        INNER JOIN semesters sem
            ON sem.id = s.semester_id

        ${buildWhere(state)}

        GROUP BY
            s.course_code,
            s.subject_name,
            s.course_type,
            s.elective_group,
            s.lecture_hours,
            s.tutorial_hours,
            s.practical_hours,
            s.credits,
            p.id,
            p.program_name,
            sem.id,
            sem.semester_number,
            sem.semester_name,
            sem.year

        ${commonHaving}

        ORDER BY
            sem.semester_number,
            s.course_code,
            s.subject_name
    `;

    console.log("SUBJECT QUERY:", sql);
    console.log("SUBJECT PARAMS:", state.params);
    console.log("COMMON SUBJECTS:", commonSubjects);
    console.log("DEPARTMENTS:", departments);

    const [rows] = await db.execute(sql, state.params);

    return makeResult(
        "Subjects",
        rows,
        commonSubjects
            ? "No common subjects found between the selected departments."
            : "No subjects found for the selected filters."
    );
}



// ============================================================
// 7. SEMESTER QUERY
// ============================================================

async function executeSemesterQuery(text) {
    await requireTables(["semesters", "programs"]);

    const state = { conditions: [], params: [] };

    const semester = detectSemesterNumber(text);
    const program = await detectProgram(text);

    if (semester !== null) {
        addCondition(
            state,
            "s.semester_number = ?",
            [semester]
        );
    }

    if (program) {
        addCondition(
            state,
            "LOWER(p.program_name) LIKE LOWER(?)",
            [`%${program}%`]
        );
    }

    const [rows] = await db.execute(
        `
        SELECT
            s.id,
            s.program_id,
            s.semester_number,
            s.semester_name,
            s.year,
            p.program_name AS program
        FROM semesters s
        INNER JOIN programs p ON p.id = s.program_id
        ${buildWhere(state)}
        ORDER BY p.program_name, s.semester_number
        `,
        state.params
    );

    return makeResult("Semesters", rows);
}


// ============================================================
// 8. BATCH QUERY
// ============================================================

async function executeBatchQuery(text) {
    await requireTables(["batches"]);

    const state = { conditions: [], params: [] };

    const columns = await getTableColumns("batches");

    const departments = await detectDepartment(text);
    const program = await detectProgram(text);
    const semester = detectSemesterNumber(text);
    const batchCode = detectBatchCode(text);
    const year = detectAcademicYear(text);

    if (departments.length && columns.includes("department")) {
        addCondition(
            state,
            `(${departments.map(() => "LOWER(department) LIKE LOWER(?)").join(" OR ")})`,
            departments.map(d => `%${d}%`)
        );
    }

    if (program && columns.includes("program")) {
        addCondition(
            state,
            "LOWER(program) LIKE LOWER(?)",
            [`%${program}%`]
        );
    }

    if (semester !== null && columns.includes("current_semester")) {
        addCondition(state, "current_semester = ?", [semester]);
    }

    if (batchCode && columns.includes("batch_code")) {
        addCondition(
            state,
            "UPPER(TRIM(batch_code)) = UPPER(TRIM(?))",
            [batchCode]
        );
    }

    if (year && columns.includes("enrollment_year")) {
        addCondition(
            state,
            "enrollment_year = ?",
            [year.startYear]
        );
    }

    if (columns.includes("is_active")) {
        if (/\binactive\b/i.test(text)) {
            addCondition(state, "is_active = 0");
        } else if (/\bactive\b/i.test(text)) {
            addCondition(state, "is_active = 1");
        }
    }

    const [rows] = await db.execute(
        `SELECT * FROM batches
         ${buildWhere(state)}
         ORDER BY enrollment_year DESC, batch_code`,
        state.params
    );

    return makeResult("Batches", rows);
}


// ============================================================
// 9. ACADEMIC SESSION QUERY
// ============================================================

async function executeAcademicSessionQuery(text) {
    await requireTables(["academic_sessions"]);

    const state = { conditions: [], params: [] };

    const year = detectAcademicYear(text);

    if (year) {
        addCondition(
            state,
            "start_year = ? AND end_year = ?",
            [year.startYear, year.endYear]
        );
    }

    if (/\b(active|current|ongoing)\b/i.test(text)) {
        addCondition(state, "is_active = 1");
    }

    if (/\b(inactive|previous|past|old)\b/i.test(text)) {
        addCondition(state, "is_active = 0");
    }

    const [rows] = await db.execute(
        `
        SELECT *
        FROM academic_sessions
        ${buildWhere(state)}
        ORDER BY start_year DESC
        `,
        state.params
    );

    return makeResult("Academic Sessions", rows);
}


// ============================================================
// 10. COMMON TIMETABLE SQL
// ============================================================

async function executeTimetableQuery(text, extraFilters = {}) {
    await requireTables([
        "timetable_entries",
        "academic_sessions",
        "programs",
        "departments",
        "semesters",
        "subjects",
        "rooms",
        "timetable_entry_faculty",
        "faculty",
        "timetable_entry_batches",
        "batches"
    ]);

    const filters = {
        ...parseTimetableFilters(text),
        ...extraFilters
    };

    const state = { conditions: [], params: [] };

    const departments = await detectDepartment(text);
    const program = await detectProgram(text);

    if (departments.length) {
        const conditions = [];

        for (const dept of departments) {
            conditions.push(
                "(LOWER(d.abbreviation) LIKE LOWER(?) OR LOWER(d.name) LIKE LOWER(?))"
            );

            state.params.push(`%${dept}%`, `%${dept}%`);
        }

        addCondition(state, `(${conditions.join(" OR ")})`);
    }

    if (program) {
        addCondition(
            state,
            "LOWER(p.program_name) LIKE LOWER(?)",
            [`%${program}%`]
        );
    }

    if (filters.semester != null) {
        addCondition(
            state,
            "sem.semester_number = ?",
            [filters.semester]
        );
    }

    if (filters.day) {
        addCondition(
            state,
            "LOWER(te.day) = LOWER(?)",
            [filters.day]
        );
    }

    const year = detectAcademicYear(text);

    if (year) {
        addCondition(
            state,
            "acs.start_year = ? AND acs.end_year = ?",
            [year.startYear, year.endYear]
        );
    } else if (/\b(active|current|ongoing)\b/i.test(text)) {
        addCondition(state, "acs.is_active = 1");
    }

    if (filters.batchId != null) {
        addCondition(
            state,
            `EXISTS (
                SELECT 1
                FROM timetable_entry_batches teb
                WHERE teb.timetable_entry_id = te.id
                AND teb.batch_id = ?
            )`,
            [filters.batchId]
        );
    } else if (filters.batchCode) {
        addCondition(
            state,
            `EXISTS (
                SELECT 1
                FROM timetable_entry_batches teb
                INNER JOIN batches b
                    ON b.id = teb.batch_id
                WHERE teb.timetable_entry_id = te.id
                AND UPPER(TRIM(b.batch_code)) = UPPER(TRIM(?))
            )`,
            [filters.batchCode]
        );
    }

    const facultyAbbreviation =
    extractFacultyAbbreviation(text);

console.log(
    "DETECTED FACULTY ABBREVIATION:",
    facultyAbbreviation
);

if (facultyAbbreviation) {
    addCondition(
        state,
        `EXISTS (
            SELECT 1
            FROM timetable_entry_faculty tef
            INNER JOIN faculty f
                ON f.id = tef.faculty_id
            WHERE tef.timetable_entry_id = te.id
            AND UPPER(TRIM(f.abbreviation)) = ?
        )`,
        [facultyAbbreviation]
    );
}

if (facultyAbbreviation) {
  const [debugRows] = await db.query(
    `
    SELECT
      te.id,
      f.name,
      f.abbreviation,
      te.day,
      te.start_time,
      te.end_time
    FROM timetable_entries te
    INNER JOIN timetable_entry_faculty tef
      ON tef.timetable_entry_id = te.id
    INNER JOIN faculty f
      ON f.id = tef.faculty_id
    WHERE LOWER(f.abbreviation) = LOWER(?)
    `,
    [facultyAbbreviation]
  );

  console.log("DIRECT FACULTY QUERY COUNT:", debugRows.length);
  console.log("DIRECT FACULTY QUERY ROWS:", debugRows);
}

    const roomId = detectRoomId(text);

    if (roomId) {
        addCondition(
            state,
            "(LOWER(r.room_id) = LOWER(?) OR LOWER(r.room_name) = LOWER(?))",
            [roomId, roomId]
        );
    }

    const timeMatch = normalizeText(text).match(
        /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
    );

    if (timeMatch) {
        let hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2] || 0);

        if (hour >= 1 && hour <= 12 && minute <= 59) {
            const period = timeMatch[3].toLowerCase();

            if (period === "pm" && hour !== 12) hour += 12;
            if (period === "am" && hour === 12) hour = 0;

            const time =
                `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

            addCondition(
                state,
                "te.start_time <= ? AND te.end_time > ?",
                [time, time]
            );
        }
    }

    const generic = new Set([
        "show", "find", "get", "give", "list", "display",
    "when", "what", "which", "where", "who", "how",
    "is", "are", "was", "were", "be", "been",
    "all", "any", "each", "every",
    "free", "available", "availability", "vacant",
    "idle", "gap", "gaps", "batches",
    "timetable", "time", "table", "schedule",
    "class", "classes", "timing", "timings",
    "lecture", "lectures",
    "for", "of", "in", "from", "on", "the", "my",
    "today", "tomorrow", "weekly", "daily",
    "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday", "sunday",
    "semester", "sem", "program", "department",
    "batch", "faculty", "teacher", "professor",
    "room", "rooms", "active", "current",
    "session", "academic", "year",
    "btech", "mtech", "b", "tech", "m"
    ]);

    const tokens = normalizeText(text)
        .split(/\s+/)
        .filter(word =>
            word.length > 2 &&
            !generic.has(word) &&
            !/^\d+$/.test(word)
        );

    if (tokens.length >= 2 && !filters.batchCode && !facultyAbbreviation && !roomId) {
        const search = `%${tokens.join(" ")}%`;

        addCondition(
            state,
            "(LOWER(sub.course_code) LIKE LOWER(?) OR LOWER(sub.subject_name) LIKE LOWER(?))",
            [search, search]
        );
    }

    const sql = `
        SELECT
            te.id AS timetable_entry_id,

            acs.id AS academic_session_id,
            acs.session_name,
            acs.start_year,
            acs.end_year,

            p.id AS program_id,
            p.program_name AS program,

            d.id AS department_id,
            d.name AS department,
            d.abbreviation AS department_code,

            sem.id AS semester_id,
            sem.semester_number,
            sem.semester_name,
            sem.year AS semester_year,

            te.day,
            te.slot_id,

            te.start_time,
            te.end_time,

            TIME_FORMAT(te.start_time, '%h:%i %p') AS start_time_formatted,
            TIME_FORMAT(te.end_time, '%h:%i %p') AS end_time_formatted,

            sub.id AS subject_id,
            sub.course_code,
            sub.subject_name,
            sub.course_type,
            sub.credits,

            te.lecture_type,

            r.id AS room_database_id,
            r.room_id,
            r.room_name,
            r.room_type,
            r.building,
            r.floor_no,
            r.capacity,

            te.total_students,

            (
                SELECT GROUP_CONCAT(
                    DISTINCT CONCAT(
                        f.name,
                        ' (',
                        COALESCE(f.abbreviation, ''),
                        ')'
                    )
                    ORDER BY f.name SEPARATOR ', '
                )
                FROM timetable_entry_faculty tef
                INNER JOIN faculty f ON f.id = tef.faculty_id
                WHERE tef.timetable_entry_id = te.id
            ) AS faculty,

            (
                SELECT GROUP_CONCAT(
                    DISTINCT b.batch_code
                    ORDER BY b.batch_code SEPARATOR ', '
                )
                FROM timetable_entry_batches teb
                INNER JOIN batches b ON b.id = teb.batch_id
                WHERE teb.timetable_entry_id = te.id
            ) AS batches

        FROM timetable_entries te

        INNER JOIN academic_sessions acs
            ON acs.id = te.academic_session_id

        INNER JOIN programs p
            ON p.id = te.program_id

        INNER JOIN departments d
            ON d.id = te.department_id

        INNER JOIN semesters sem
            ON sem.id = te.semester_id

        INNER JOIN subjects sub
            ON sub.id = te.subject_id

        INNER JOIN rooms r
            ON r.id = te.room_id

        ${buildWhere(state)}

        ORDER BY
            FIELD(
                LOWER(te.day),
                'monday','tuesday','wednesday',
                'thursday','friday','saturday'
            ),
            te.start_time,
            te.id
    `;

    const [rows] = await db.execute(sql, state.params);

    return makeResult(
        "Timetable",
        rows,
        "No timetable entries found for the selected filters."
    );
}


// ============================================================
// 11. TIME CONVERSION
// ============================================================

function timeToMinutes(value) {
    if (value == null) return null;

    if (value instanceof Date) {
        return value.getUTCHours() * 60 +
            value.getUTCMinutes() +
            Math.floor(value.getUTCSeconds() / 60);
    }

    const match = String(value).match(
        /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/
    );

    if (!match) {
        throw new Error(`Invalid database time: ${value}`);
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
        throw new Error(`Invalid database time: ${value}`);
    }

    return hours * 60 + minutes;
}

function minutesToTime(total) {
    return (
        String(Math.floor(total / 60)).padStart(2, "0") +
        ":" +
        String(total % 60).padStart(2, "0") +
        ":00"
    );
}

function formatTime(total) {
    const hour = Math.floor(total / 60);
    const minute = total % 60;

    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;

    return (
        String(hour12).padStart(2, "0") +
        ":" +
        String(minute).padStart(2, "0") +
        " " +
        period
    );
}


// ============================================================
// 12. FREE SLOT CALCULATION
//
// Default minimum: 50 minutes.
//
// Only gaps BETWEEN recorded classes are calculated.
// ============================================================


// ============================================================
// 12. FREE SLOT CALCULATION
//
// Default minimum: 1 minute.
//
// If requestedDays is supplied, calculate only those days.
// Otherwise, calculate all working days.
// ============================================================

function calculateFreeSlots(
    rows,
    minFreeMinutes = 11,
    collegeStart = "08:00:00",
    collegeEnd = "17:00:00",
    requestedDays = []
) {
    const grouped = {};

    const dayOrder = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const collegeStartMinutes = timeToMinutes(collegeStart);
    const collegeEndMinutes = timeToMinutes(collegeEnd);

    if (collegeEndMinutes <= collegeStartMinutes) {
        throw new Error("Invalid college timings.");
    }

    // Normalize requested days and restrict calculation to them.
    const selectedDays = requestedDays.length
        ? dayOrder.filter(day =>
            requestedDays.some(
                requestedDay =>
                    String(requestedDay).toLowerCase() === day.toLowerCase()
            )
        )
        : dayOrder;

    // Initialize only the selected days.
    for (const day of selectedDays) {
        grouped[day] = [];
    }

    // Group timetable entries by day.
    for (const row of rows) {
        if (!row.day) continue;

        const day = dayOrder.find(
            d => d.toLowerCase() === String(row.day).toLowerCase()
        );

        // Ignore entries outside the selected days.
        if (!day || !selectedDays.includes(day)) continue;

        const start = timeToMinutes(row.start_time);
        const end = timeToMinutes(row.end_time);

        if (start === null || end === null || end <= start) {
            continue;
        }

        // Restrict class timings to college hours.
        const adjustedStart = Math.max(
            start,
            collegeStartMinutes
        );

        const adjustedEnd = Math.min(
            end,
            collegeEndMinutes
        );

        if (adjustedEnd <= adjustedStart) continue;

        grouped[day].push({
            start: adjustedStart,
            end: adjustedEnd
        });
    }

    const freeSlots = [];

    // IMPORTANT: Loop only through selected days.
    for (const day of selectedDays) {
        const classes = grouped[day] || [];

        // Sort classes by start time.
        classes.sort((a, b) => a.start - b.start);

        // Merge overlapping classes.
        const merged = [];

        for (const current of classes) {
            const last = merged[merged.length - 1];

            if (!last || current.start > last.end) {
                merged.push({
                    start: current.start,
                    end: current.end
                });
            } else {
                last.end = Math.max(last.end, current.end);
            }
        }

        let currentTime = collegeStartMinutes;

        // Find gaps before and between classes.
        for (const cls of merged) {
            if (cls.start > currentTime) {
                const gap = cls.start - currentTime;

                if (gap >= minFreeMinutes) {
                    freeSlots.push({
                        day,
                        free_slot: `${minutesToTime(currentTime)} - ${minutesToTime(cls.start)}`,
                       // free_until: minutesToTime(cls.start),
                        //free_from_formatted: formatTime(currentTime),
                        //free_until_formatted: formatTime(cls.start),
                        //duration_minutes: gap,
                        duration: `${Math.floor(gap / 60)} hour(s) ${gap % 60} minute(s)`
                    });
                }
            }

            currentTime = Math.max(currentTime, cls.end);
        }

        // Find gap after the last class.
        // If there are no classes, the entire selected day is free.
        if (currentTime < collegeEndMinutes) {
            const gap = collegeEndMinutes - currentTime;

            if (gap >minFreeMinutes) {
                freeSlots.push({
                    day,
                    free_slot: `${minutesToTime(currentTime)} - ${minutesToTime(collegeEndMinutes)}`,

                    //free_from: minutesToTime(currentTime),
                    //free_until: minutesToTime(collegeEndMinutes),
                    //free_from_formatted: formatTime(currentTime),
                    //free_until_formatted: formatTime(collegeEndMinutes),
                   // duration_minutes: gap,
                    duration: `${Math.floor(gap / 60)} hour(s) ${gap % 60} minute(s)`
                });
            }
        }
    }

    return freeSlots.sort((a, b) => {
    const difference =
        dayOrder.indexOf(a.day) -
        dayOrder.indexOf(b.day);

    if (difference !== 0) return difference;

    return timeToMinutes(
        a.free_slot.split(" - ")[0]
    ) - timeToMinutes(
        b.free_slot.split(" - ")[0]
    );
});
}



// ============================================================
// FILTER VALIDATION
// ============================================================

function validateFilters(filters = {}) {

    if (
        filters.semester !== undefined &&
        filters.semester !== null
    ) {
        const semester = Number(filters.semester);

        if (
            !Number.isInteger(semester) ||
            semester < 1 ||
            semester > 12
        ) {
            throw new Error("Invalid semester number.");
        }
    }

    if (filters.minFreeMinutes !== undefined) {
        const minutes = Number(filters.minFreeMinutes);

        if (
            !Number.isFinite(minutes) ||
            minutes < 1 ||
            minutes > 540
        ) {
            throw new Error("Invalid minimum free duration.");
        }
    }

    if (
        filters.batchId !== undefined &&
        filters.batchId !== null
    ) {
        const batchId = Number(filters.batchId);

        if (
            !Number.isInteger(batchId) ||
            batchId < 1
        ) {
            throw new Error("Invalid batch ID.");
        }
    }

    return true;
}

// ============================================================
// 13. FREE SLOT QUERY
// ============================================================



async function executeFreeSlotQuery(queryOrFilters = {}) {

    // Support both natural-language queries and filter objects.
    const queryText =
        typeof queryOrFilters === "string"
            ? queryOrFilters
            : "";

    const filters = queryText
        ? parseTimetableFilters(queryText)
        : queryOrFilters;

    validateFilters(filters);

    const minFreeMinutes =
        filters.minFreeMinutes === undefined
            ? 11
            : Number(filters.minFreeMinutes);

    // Detect requested day.
    const requestedDay =
        filters.day || detectDay(queryText);

    const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    if (
        requestedDay &&
        !validDays.some(
            day =>
                day.toLowerCase() ===
                String(requestedDay).toLowerCase()
        )
    ) {
        throw new Error("Invalid day requested.");
    }

    const normalizedDay = requestedDay
        ? validDays.find(
            day =>
                day.toLowerCase() ===
                String(requestedDay).toLowerCase()
        )
        : null;

    // REUSE EXISTING TIMETABLE QUERY FUNCTION.
    const timetableResult = await executeTimetableQuery(
        queryText,
        {
            ...filters,
            day: normalizedDay
        }
    );

    const rows = timetableResult.data;

    const resultFilters = {
        batchCode: filters.batchCode || null,
        batchId: filters.batchId || null,
        semester: filters.semester || null,
        day: normalizedDay,
        enrollmentYear: filters.enrollmentYear || null,
        collegeStart: "08:00 AM",
        collegeEnd: "05:00 PM",
        minimumFreeMinutes: minFreeMinutes
    };

    if (!rows.length) {
        return {
            type: "FREE_SLOTS",
            count: 0,
            timetableEntryCount: 0,
            filters: resultFilters,
            data: [],
            message: normalizedDay
                ? `No timetable entries found on ${normalizedDay}.`
                : "No timetable entries found for the selected filters."
        };
    }

    // Calculate free periods using fetched timetable entries.
    const freeSlots = calculateFreeSlots(
        rows,
        minFreeMinutes,
        "08:00:00",
        "17:00:00",
        normalizedDay ? [normalizedDay] : []
    );

    return {
        type: "FREE_SLOTS",
        count: freeSlots.length,
        timetableEntryCount: rows.length,
        filters: resultFilters,
        data: freeSlots,
        message: freeSlots.length
            ? null
            : normalizedDay
                ? `No free periods found on ${normalizedDay}.`
                : "No free periods found during college hours."
    };
}




// ============================================================
// 14. TIMETABLE CONFIGURATION QUERY
// ============================================================

async function executeTimetableConfigurationQuery(text) {
    await requireTables(["timetable_configurations"]);

    const columns = await getTableColumns(
        "timetable_configurations"
    );

    const state = { conditions: [], params: [] };

    const departments = await detectDepartment(text);
    const program = await detectProgram(text);
    const semester = detectSemesterNumber(text);

    const deptCol = findColumn(columns, ["department"]);
    const programCol = findColumn(columns, ["program"]);
    const semesterCol = findColumn(columns, ["semester"]);

    if (departments.length && deptCol) {
        addCondition(
            state,
            `(${departments.map(() =>
                `LOWER(${escapeIdentifier(deptCol)}) LIKE LOWER(?)`
            ).join(" OR ")})`,
            departments.map(d => `%${d}%`)
        );
    }

    if (program && programCol) {
        const normalized = program.replace(/\s+/g, "").toUpperCase();

        addCondition(
            state,
            `UPPER(${escapeIdentifier(programCol)}) = ?`,
            [normalized]
        );
    }

    if (semester !== null && semesterCol) {
        addCondition(
            state,
            `${escapeIdentifier(semesterCol)} = ?`,
            [semester]
        );
    }

    const [rows] = await db.execute(
        `SELECT * FROM timetable_configurations
         ${buildWhere(state)}
         ORDER BY department, program, semester`,
        state.params
    );

    return makeResult("Timetable Configurations", rows);
}


// ============================================================
// 15. MAIN EXECUTOR
//
// IMPORTANT:
// Your controller calls executeQuery(query).
// This function must be exported.
// ============================================================

async function executeQuery(userQuery) {
    if (!userQuery || !String(userQuery).trim()) {
        return {
            type: "Unknown",
            count: 0,
            data: [],
            message: "Please enter a query."
        };
    }

    const text = normalizeText(userQuery);

    console.log("");
    console.log("====================================");
    console.log("CAMPUS SCHEDULER QUERY");
    console.log("====================================");
    console.log("Original:", userQuery);
    console.log("Normalized:", text);

    try {
        const intent = detectIntent(text);

        console.log("Detected intent:", intent);

        let result;

        switch (intent) {
            case "FACULTY":
                result = await executeFacultyQuery(text);
                break;

            case "ROOM":
                result = await executeRoomQuery(text);
                break;

            case "SUBJECT":
                result = await executeSubjectQuery(text);
                break;

            case "SEMESTER":
                result = await executeSemesterQuery(text);
                break;

            case "BATCH":
                result = await executeBatchQuery(text);
                break;

            case "ACADEMIC_SESSION":
                result = await executeAcademicSessionQuery(text);
                break;

            case "TIMETABLE":
                result = await executeTimetableQuery(text);
                break;

            case "FREE_SLOTS":
                result = await executeFreeSlotQuery(text);
                break;

            case "TIMETABLE_CONFIGURATION":
                result = await executeTimetableConfigurationQuery(text);
                break;

            default:
                result = {
                    type: "Unknown",
                    count: 0,
                    data: [],
                    message:
                        "I could not understand your query. Try faculty, rooms, subjects, semesters, batches, academic sessions, timetable or free periods."
                };
        }

        console.log("Result type:", result.type);
        console.log("Result count:", result.count);

        return result;

    } catch (error) {
        console.error("QUERY SERVICE ERROR:", error);
        throw error;
    }
}


// ============================================================
// 16. EXPORTS
// ============================================================

module.exports = {
    executeQuery,

    detectIntent,
    detectBatchCode,
    detectSemesterNumber,
    detectDay,
    detectAcademicYear,
    detectDepartment,
    detectProgram,

    parseTimetableFilters,

    executeFacultyQuery,
    executeRoomQuery,
    executeSubjectQuery,
    executeSemesterQuery,
    executeBatchQuery,
    executeAcademicSessionQuery,
    executeTimetableQuery,
    executeFreeSlotQuery,
    executeTimetableConfigurationQuery,

    calculateFreeSlots
};
