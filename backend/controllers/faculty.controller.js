const fs = require("fs");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const db = require("../config/db");


// ==================================================
// PREVIEW FACULTY CSV / EXCEL
// ==================================================

exports.previewFaculty = (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            message: "Please upload a CSV or Excel file"
        });
    }

    const filePath = req.file.path;

    const extension =
        req.file.originalname
            .split(".")
            .pop()
            .toLowerCase();


    // ==================================================
    // REQUIRED COLUMNS
    // ==================================================

    const requiredColumns = [
        "faculty_id",
        "name",
        "abbreviation",
        "department"
    ];


    // ==================================================
    // PROCESS ROWS
    // ==================================================

    const processRows = (rawRows) => {

        const rows = [];
        const errors = [];


        // ----------------------------------------------
        // NORMALIZE HEADERS
        // ----------------------------------------------

        const firstRow = rawRows[0];

        if (!firstRow) {

            return res.status(400).json({
                message: "File is empty"
            });

        }


        const headers =
            Object.keys(firstRow);


        const headerMap = {};

        headers.forEach(header => {

            headerMap[
                header.trim().toLowerCase()
            ] = header;

        });


        // ----------------------------------------------
        // CHECK REQUIRED COLUMNS
        // ----------------------------------------------

        const missingColumns =
            requiredColumns.filter(
                column =>
                    !headerMap[column]
            );


        if (missingColumns.length > 0) {

            return res.status(400).json({

                message:
                    `Missing columns: ${missingColumns.join(", ")}`

            });

        }


        // ----------------------------------------------
        // READ ROWS
        // ----------------------------------------------

        rawRows.forEach((rawRow, index) => {

            const rowNumber = index + 2;


            const facultyId =
                String(
                    rawRow[
                        headerMap["faculty_id"]
                    ] ?? ""
                ).trim();


            const name =
                String(
                    rawRow[
                        headerMap["name"]
                    ] ?? ""
                ).trim();


            const abbreviation =
                String(
                    rawRow[
                        headerMap["abbreviation"]
                    ] ?? ""
                )
                .trim()
                .toUpperCase();


            const department =
                String(
                    rawRow[
                        headerMap["department"]
                    ] ?? ""
                ).trim();


            // ------------------------------------------
            // VALIDATE FACULTY ID
            // ------------------------------------------

            if (!facultyId) {

                errors.push({

                    row: rowNumber,

                    field: "faculty_id",

                    message:
                        "Faculty ID is required"

                });

            }


            // ------------------------------------------
            // VALIDATE NAME
            // ------------------------------------------

            if (!name) {

                errors.push({

                    row: rowNumber,

                    field: "name",

                    message:
                        "Name is required"

                });

            }


            // ------------------------------------------
            // VALIDATE ABBREVIATION
            // ------------------------------------------

            if (!abbreviation) {

                errors.push({

                    row: rowNumber,

                    field: "abbreviation",

                    message:
                        "Abbreviation is required"

                });

            }


            // ------------------------------------------
            // VALIDATE DEPARTMENT
            // ------------------------------------------

            if (!department) {

                errors.push({

                    row: rowNumber,

                    field: "department",

                    message:
                        "Department is required"

                });

            }


            // ------------------------------------------
            // ADD ROW
            // ------------------------------------------

            rows.push({

                faculty_id: facultyId,

                name,

                abbreviation,

                department,

                rowNumber

            });

        });


        // ----------------------------------------------
        // CHECK DUPLICATE FACULTY IDs IN FILE
        // ----------------------------------------------

        const facultyIdMap = new Map();


        rows.forEach(row => {

            if (!row.faculty_id) {
                return;
            }


            if (
                facultyIdMap.has(
                    row.faculty_id
                )
            ) {

                errors.push({

                    row: row.rowNumber,

                    field: "faculty_id",

                    message:
                        `Duplicate faculty ID "${row.faculty_id}" in file`

                });

            }
            else {

                facultyIdMap.set(
                    row.faculty_id,
                    row.rowNumber
                );

            }

        });


        // ----------------------------------------------
        // DELETE TEMP FILE
        // ----------------------------------------------

        fs.unlink(
            filePath,
            (err) => {

                if (err) {

                    console.error(
                        "Failed to delete uploaded file:",
                        err.message
                    );

                }

            }
        );


        // ----------------------------------------------
        // VALID ROWS
        // ----------------------------------------------

        const validRows =
            rows.filter(row => {

                return !errors.some(
                    error =>
                        error.row === row.rowNumber
                );

            });


        // ----------------------------------------------
        // RESPONSE
        // ----------------------------------------------

        return res.json({

            success:
                errors.length === 0,

            totalRows:
                rows.length,

            validRows:
                validRows.length,

            errorCount:
                errors.length,

            errors,

            data:
                rows

        });

    };


    // ==================================================
    // EXCEL FILE
    // ==================================================

    if (
        extension === "xlsx" ||
        extension === "xls"
    ) {

        try {

            const workbook =
                XLSX.readFile(filePath);


            const sheetName =
                workbook.SheetNames[0];


            const worksheet =
                workbook.Sheets[sheetName];


            const rawRows =
                XLSX.utils.sheet_to_json(
                    worksheet,
                    {
                        defval: ""
                    }
                );


            return processRows(rawRows);

        }
        catch (error) {

            console.error(
                "Excel read error:",
                error
            );


            return res.status(500).json({

                message:
                    "Failed to read Excel file",

                error:
                    error.message

            });

        }

    }


    // ==================================================
    // CSV FILE
    // ==================================================

    if (extension === "csv") {

        const rawRows = [];


        fs.createReadStream(filePath)

            .pipe(csv())

            .on("data", row => {

                rawRows.push(row);

            })

            .on("end", () => {

                return processRows(
                    rawRows
                );

            })

            .on("error", error => {

                console.error(
                    "CSV read error:",
                    error
                );


                return res.status(500).json({

                    message:
                        "Failed to read CSV file",

                    error:
                        error.message

                });

            });

        return;
    }


    // ==================================================
    // INVALID FILE TYPE
    // ==================================================

    return res.status(400).json({

        message:
            "Only CSV, XLS, and XLSX files are supported"

    });

};


// ==================================================
// IMPORT FACULTY
// INSERT / UPDATE / UNCHANGED
// ==================================================

exports.importFaculty = async (req, res) => {

    const { data } = req.body;


    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (!Array.isArray(data) || data.length === 0) {

        return res.status(400).json({
            message: "No faculty data received"
        });

    }


    // ==================================================
    // VALIDATE EVERY ROW
    // ==================================================

    for (let i = 0; i < data.length; i++) {

        const row = data[i];

        if (!row.faculty_id) {

            return res.status(400).json({
                message: `Faculty ID missing at row ${i + 1}`
            });

        }

        if (!row.name) {

            return res.status(400).json({
                message: `Name missing at row ${i + 1}`
            });

        }

        if (!row.abbreviation) {

            return res.status(400).json({
                message: `Abbreviation missing at row ${i + 1}`
            });

        }

        if (!row.department) {

            return res.status(400).json({
                message: `Department missing at row ${i + 1}`
            });

        }

    }


    // ==================================================
    // NORMALIZE DATA
    // ==================================================

    const normalizedData = data.map(row => ({

        faculty_id:
            String(row.faculty_id).trim(),

        name:
            String(row.name).trim(),

        abbreviation:
            String(row.abbreviation)
                .trim()
                .toUpperCase(),

        department:
            String(row.department).trim()

    }));


    // ==================================================
    // GET FACULTY IDS FROM CSV
    // ==================================================

    const facultyIds =
        normalizedData.map(row => row.faculty_id);


    // ==================================================
    // FIND EXISTING FACULTY
    // ==================================================

    const placeholders =
        facultyIds.map(() => "?").join(",");


    const selectSql = `

        SELECT
            faculty_id,
            name,
            abbreviation,
            department

        FROM faculty

        WHERE faculty_id IN (${placeholders})

    `;


    db.query(
        selectSql,
        facultyIds,
        (selectError, existingRows) => {

            if (selectError) {

                console.error(
                    "Faculty lookup error:",
                    selectError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Failed to check existing faculty",

                    error:
                        selectError.message

                });

            }


            // ==================================================
            // CREATE MAP OF EXISTING FACULTY
            // ==================================================

            const existingMap = new Map();


            existingRows.forEach(row => {

                existingMap.set(
                    String(row.faculty_id),
                    row
                );

            });


            // ==================================================
            // COUNTERS
            // ==================================================

            let inserted = 0;

            let updated = 0;

            let unchanged = 0;


            // ==================================================
            // CHECK EACH CSV ROW
            // ==================================================

            normalizedData.forEach(row => {

                const existing =
                    existingMap.get(row.faculty_id);


                // ------------------------------------------
                // NEW FACULTY
                // ------------------------------------------

                if (!existing) {

                    inserted++;

                    return;

                }


                // ------------------------------------------
                // CHECK IF DATA CHANGED
                // ------------------------------------------

                const isSame =

                    String(existing.name).trim()
                    === row.name

                    &&

                    String(existing.abbreviation)
                        .trim()
                        .toUpperCase()
                    === row.abbreviation

                    &&

                    String(existing.department).trim()
                    === row.department;


                if (isSame) {

                    unchanged++;

                } else {

                    updated++;

                }

            });


            // ==================================================
            // PREPARE BULK UPSERT
            // ==================================================

            const values =
                normalizedData.map(row => [

                    row.faculty_id,

                    row.name,

                    row.abbreviation,

                    row.department

                ]);


            const upsertSql = `

                INSERT INTO faculty
                (
                    faculty_id,
                    name,
                    abbreviation,
                    department
                )

                VALUES ?

                ON DUPLICATE KEY UPDATE

                    name = VALUES(name),

                    abbreviation = VALUES(abbreviation),

                    department = VALUES(department)

            `;


            // ==================================================
            // EXECUTE BULK UPSERT
            // ==================================================

            db.query( upsertSql, [values],
                (insertError, result) => {

                    if (insertError) {
                        console.error( "Faculty import error:", insertError );

                        return res.status(500).json({
                            success: false,
                            message: "Faculty import failed",
                            error: insertError.message
                        });
                    }

                    // ==================================================
                    // RESPONSE
                    // ==================================================

                    return res.json({

                        success: true,
                        message: "Faculty import completed successfully",
                        total: normalizedData.length,
                        inserted,
                        updated,
                        unchanged

                    });
               }
            );
        }
    );
};



// ==================================================
// GET FACULTY
// ==================================================

exports.getFaculty = async (req, res) => {

    const sql = `
        SELECT
            id,
            faculty_id,
            name,
            abbreviation,
            department,
            created_at,
            updated_at
        FROM faculty
        ORDER BY
            department ASC,
            name ASC
    `;

    try {

        const [results] = await db.query(sql);

        return res.json(results);

    } catch (err) {

        console.error(
            "Failed to fetch faculty:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch faculty"
        });

    }

};

// ==================================================
// ADD FACULTY
// ==================================================

exports.addFaculty = async (req, res) => {

    const {
        faculty_id,
        name,
        abbreviation,
        department
    } = req.body;

    // ----------------------------------------------
    // VALIDATION
    // ----------------------------------------------

    if (!faculty_id) {
        return res.status(400).json({
            success: false,
            message: "Faculty ID is required"
        });
    }

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Name is required"
        });
    }

    if (!abbreviation) {
        return res.status(400).json({
            success: false,
            message: "Abbreviation is required"
        });
    }

    if (!department) {
        return res.status(400).json({
            success: false,
            message: "Department is required"
        });
    }

    // ----------------------------------------------
    // NORMALIZE
    // ----------------------------------------------

    const normalizedFacultyId =
        String(faculty_id).trim();

    const normalizedName =
        String(name).trim();

    const normalizedAbbreviation =
        String(abbreviation)
            .trim()
            .toUpperCase();

    const normalizedDepartment =
        String(department).trim();

    // ----------------------------------------------
    // CHECK DUPLICATE FACULTY ID
    // ----------------------------------------------

    const checkSql = `
        SELECT id
        FROM faculty
        WHERE faculty_id = ?
        LIMIT 1
    `;

    try {

        const [existing] =
            await db.query(
                checkSql,
                [normalizedFacultyId]
            );

        if (existing.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    `Faculty ID "${normalizedFacultyId}" already exists`
            });

        }

        // ------------------------------------------
        // INSERT
        // ------------------------------------------

        const insertSql = `
            INSERT INTO faculty
            (
                faculty_id,
                name,
                abbreviation,
                department
            )
            VALUES (?, ?, ?, ?)
        `;

        const [result] =
            await db.query(
                insertSql,
                [
                    normalizedFacultyId,
                    normalizedName,
                    normalizedAbbreviation,
                    normalizedDepartment
                ]
            );

        return res.status(201).json({

            success: true,

            message:
                "Faculty added successfully",

            id: result.insertId

        });

    } catch (err) {

        console.error(
            "Failed to add faculty:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to add faculty",

            error:
                err.message

        });

    }

};


// ==================================================
// EDIT FACULTY
// ==================================================

exports.updateFaculty = async (req, res) => {

    const { id } = req.params;

    const {
        faculty_id,
        name,
        abbreviation,
        department
    } = req.body;

    // ----------------------------------------------
    // VALIDATION
    // ----------------------------------------------

    if (!faculty_id) {
        return res.status(400).json({
            success: false,
            message: "Faculty ID is required"
        });
    }

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Name is required"
        });
    }

    if (!abbreviation) {
        return res.status(400).json({
            success: false,
            message: "Abbreviation is required"
        });
    }

    if (!department) {
        return res.status(400).json({
            success: false,
            message: "Department is required"
        });
    }

    const normalizedFacultyId =
        String(faculty_id).trim();

    const normalizedName =
        String(name).trim();

    const normalizedAbbreviation =
        String(abbreviation)
            .trim()
            .toUpperCase();

    const normalizedDepartment =
        String(department).trim();

    try {

        // ------------------------------------------
        // CHECK DATABASE ID EXISTS
        // ------------------------------------------

        const [faculty] = await db.query(
            `
            SELECT id
            FROM faculty
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (faculty.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Faculty not found"
            });

        }

        // ------------------------------------------
        // CHECK IF FACULTY_ID ALREADY EXISTS
        // FOR ANOTHER FACULTY
        // ------------------------------------------

        const [duplicate] = await db.query(
            `
            SELECT id
            FROM faculty
            WHERE faculty_id = ?
            AND id != ?
            LIMIT 1
            `,
            [
                normalizedFacultyId,
                id
            ]
        );

        if (duplicate.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    `Faculty ID "${normalizedFacultyId}" already exists`
            });

        }

        // ------------------------------------------
        // UPDATE USING DATABASE ID
        // ------------------------------------------

        await db.query(
            `
            UPDATE faculty
            SET
                faculty_id = ?,
                name = ?,
                abbreviation = ?,
                department = ?
            WHERE id = ?
            `,
            [
                normalizedFacultyId,
                normalizedName,
                normalizedAbbreviation,
                normalizedDepartment,
                id
            ]
        );

        return res.json({

            success: true,

            message:
                "Faculty updated successfully"

        });

    } catch (err) {

        console.error(
            "Failed to update faculty:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to update faculty",

            error:
                err.message

        });

    }
};

// ==================================================
// DELETE FACULTY
// ==================================================

exports.deleteFaculty = async (req, res) => {

    const { id } = req.params;

    try {

        // ------------------------------------------
        // CHECK FACULTY EXISTS
        // ------------------------------------------

        const [faculty] =
            await db.query(
                `
                SELECT id
                FROM faculty
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );

        if (faculty.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Faculty not found"

            });

        }

        // ------------------------------------------
        // DELETE
        // ------------------------------------------

        await db.query(
            `
            DELETE FROM faculty
            WHERE id = ?
            `,
            [id]
        );

        return res.json({

            success: true,

            message:
                "Faculty deleted successfully"

        });

    } catch (err) {

        console.error(
            "Failed to delete faculty:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to delete faculty",

            error:
                err.message

        });

    }

};