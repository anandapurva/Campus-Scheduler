const db = require("../config/db");


// ============================================================
// YEAR → SEMESTERS MAPPING
// ============================================================

function getSemesters(program, year) {

    const normalizedProgram = String(program).toUpperCase();
    const yearNumber = Number(year);


    if (normalizedProgram === "BTECH") {

        const mapping = {
            1: [1, 2],
            2: [3, 4],
            3: [5, 6],
            4: [7, 8]
        };

        return mapping[yearNumber] || null;
    }


    if (normalizedProgram === "MTECH") {

        const mapping = {
            1: [1, 2],
            2: [3, 4]
        };

        return mapping[yearNumber] || null;
    }


    return null;
}



// ============================================================
// VALIDATE LUNCH SLOT
// ============================================================

function isValidLunchSlot(lunchStart, lunchEnd) {

    const allowedLunchSlots = [

        {
            start: "12:00:00",
            end: "13:00:00"
        },

        {
            start: "13:00:00",
            end: "14:00:00"
        },

        {
            start: "14:00:00",
            end: "15:00:00"
        }

    ];


    return allowedLunchSlots.some(
        slot =>
            slot.start === lunchStart &&
            slot.end === lunchEnd
    );
}



// ============================================================
// LOCK LUNCH
// ADMIN ONLY
// ============================================================

exports.lockLunch = async (req, res) => {

    let connection;


    try {

        const {
            program,
            year,
            lunchStart,
            lunchEnd,
            facultyId
        } = req.body;


        // ====================================================
        // VALIDATION
        // ====================================================

        if (
            !program ||
            !year ||
            !lunchStart ||
            !lunchEnd ||
            !facultyId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Program, year, lunch slot and faculty ID are required."

            });

        }


        // ====================================================
        // NORMALIZE
        // ====================================================

        const normalizedProgram =
            String(program).trim().toUpperCase();

        const yearNumber =
            Number(year);


        // ====================================================
        // VALIDATE PROGRAM
        // ====================================================

        if (
            normalizedProgram !== "BTECH" &&
            normalizedProgram !== "MTECH"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid program. Only BTECH and MTECH are allowed."

            });

        }


        // ====================================================
        // GET SEMESTERS FOR YEAR
        // ====================================================

        const semesters =
            getSemesters(
                normalizedProgram,
                yearNumber
            );


        if (!semesters) {

            return res.status(400).json({

                success: false,

                message:
                    `Invalid year ${yearNumber} for ${normalizedProgram}.`

            });

        }


        // ====================================================
        // VALIDATE LUNCH
        // ====================================================

        if (
            !isValidLunchSlot(
                lunchStart,
                lunchEnd
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid lunch slot. Allowed slots are 12:00-13:00, 13:00-14:00 and 14:00-15:00."

            });

        }


        // ====================================================
        // START TRANSACTION
        // ====================================================

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // ====================================================
        // CHECK WHETHER ANY SEMESTER IS ALREADY LOCKED
        // ====================================================

        const placeholders =
            semesters
                .map(() => "?")
                .join(",");


        const checkSql = `

            SELECT
                id,
                program,
                semester,
                lunch_start,
                lunch_end,
                locked_by,
                locked_at

            FROM timetable_configurations

            WHERE department IS NULL
            AND program = ?
            AND semester IN (${placeholders})

            FOR UPDATE

        `;


        const [existingRows] =
            await connection.query(
                checkSql,
                [
                    normalizedProgram,
                    ...semesters
                ]
            );


        // ====================================================
        // ALREADY LOCKED
        // ====================================================

        if (existingRows.length > 0) {

            await connection.rollback();


            return res.status(409).json({

                success: false,

                locked: true,

                message:
                    `${normalizedProgram} Year ${yearNumber} lunch is already locked.`,

                existingConfigurations:
                    existingRows.map(row => ({

                        id:
                            row.id,

                        program:
                            row.program,

                        semester:
                            row.semester,

                        lunchStart:
                            row.lunch_start,

                        lunchEnd:
                            row.lunch_end,

                        lockedBy:
                            row.locked_by,

                        lockedAt:
                            row.locked_at

                    }))

            });

        }


        // ====================================================
        // INSERT BOTH SEMESTERS
        // ====================================================

        const insertSql = `

            INSERT INTO timetable_configurations

            (
                department,
                program,
                semester,
                lunch_start,
                lunch_end,
                locked_by
            )

            VALUES
            (NULL, ?, ?, ?, ?, ?),
            (NULL, ?, ?, ?, ?, ?)

        `;


        await connection.query(
            insertSql,
            [

                normalizedProgram,
                semesters[0],
                lunchStart,
                lunchEnd,
                facultyId,

                normalizedProgram,
                semesters[1],
                lunchStart,
                lunchEnd,
                facultyId

            ]
        );


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // SUCCESS
        // ====================================================

        return res.status(201).json({

            success: true,

            locked: true,

            message:
                `${normalizedProgram} Year ${yearNumber} lunch locked successfully.`,

            configuration: {

                program:
                    normalizedProgram,

                year:
                    yearNumber,

                semesters:
                    semesters,

                lunchStart:
                    lunchStart,

                lunchEnd:
                    lunchEnd,

                lockedBy:
                    facultyId

            }

        });

    }


    catch (error) {

        if (connection) {

            try {
                await connection.rollback();
            }
            catch (rollbackError) {
                console.error(
                    "ROLLBACK ERROR:",
                    rollbackError
                );
            }

        }


        console.error(
            "LOCK LUNCH ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to lock lunch.",

            error:
                error.message

        });

    }


    finally {

        if (connection) {
            connection.release();
        }

    }

};

// ============================================================
// CHANGE LUNCH
// ADMIN ONLY
//
// Changes the already locked lunch of a complete year.
//
// Example:
//
// BTECH Year 1
// Sem 1 + Sem 2
//
// 12-1
//   ↓
// 1-2
//
// ============================================================

exports.changeLunch = async (req, res) => {

    let connection;


    try {

        const {
            program,
            year,
            lunchStart,
            lunchEnd,
            facultyId
        } = req.body;


        // ====================================================
        // VALIDATION
        // ====================================================

        if (
            !program ||
            !year ||
            !lunchStart ||
            !lunchEnd ||
            !facultyId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Program, year, lunch slot and faculty ID are required."

            });

        }


        // ====================================================
        // NORMALIZE
        // ====================================================

        const normalizedProgram =
            String(program)
                .trim()
                .toUpperCase();

        const yearNumber =
            Number(year);


        // ====================================================
        // VALIDATE PROGRAM
        // ====================================================

        if (
            normalizedProgram !== "BTECH" &&
            normalizedProgram !== "MTECH"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid program. Only BTECH and MTECH are allowed."

            });

        }


        // ====================================================
        // GET SEMESTERS
        // ====================================================

        const semesters =
            getSemesters(
                normalizedProgram,
                yearNumber
            );


        if (!semesters) {

            return res.status(400).json({

                success: false,

                message:
                    `Invalid year ${yearNumber} for ${normalizedProgram}.`

            });

        }


        // ====================================================
        // VALIDATE LUNCH SLOT
        // ====================================================

        if (
            !isValidLunchSlot(
                lunchStart,
                lunchEnd
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid lunch slot. Allowed slots are 12:00-13:00, 13:00-14:00 and 14:00-15:00."

            });

        }


        // ====================================================
        // GET DB CONNECTION
        // ====================================================

        connection =
            await db.getConnection();


        // ====================================================
        // START TRANSACTION
        // ====================================================

        await connection.beginTransaction();


        // ====================================================
        // CHECK EXISTING CONFIGURATION
        // ====================================================

        const placeholders =
            semesters
                .map(() => "?")
                .join(",");


        const checkSql = `

            SELECT

                id,
                program,
                semester,
                lunch_start,
                lunch_end,
                locked_by,
                locked_at

            FROM timetable_configurations

            WHERE department IS NULL

            AND program = ?

            AND semester IN (${placeholders})

            FOR UPDATE

        `;


        const [existingRows] =
            await connection.query(
                checkSql,
                [
                    normalizedProgram,
                    ...semesters
                ]
            );


        // ====================================================
        // BOTH SEMESTERS MUST EXIST
        // ====================================================

        if (
            existingRows.length !==
            semesters.length
        ) {

            await connection.rollback();


            return res.status(404).json({

                success: false,

                message:
                    `${normalizedProgram} Year ${yearNumber} does not have a complete lunch configuration. Please lock the lunch first.`,

                existingConfigurations:
                    existingRows.map(row => ({

                        id:
                            row.id,

                        semester:
                            row.semester,

                        lunchStart:
                            row.lunch_start,

                        lunchEnd:
                            row.lunch_end

                    }))

            });

        }


        // ====================================================
        // UPDATE BOTH SEMESTERS
        // ====================================================

        const updateSql = `

            UPDATE timetable_configurations

            SET

                lunch_start = ?,

                lunch_end = ?,

                locked_by = ?,

                locked_at = CURRENT_TIMESTAMP

            WHERE department IS NULL

            AND program = ?

            AND semester IN (${placeholders})

        `;


        await connection.query(
            updateSql,
            [
                lunchStart,
                lunchEnd,
                facultyId,
                normalizedProgram,
                ...semesters
            ]
        );


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


        // ====================================================
        // SUCCESS
        // ====================================================

        return res.status(200).json({

            success: true,

            changed: true,

            message:
                `${normalizedProgram} Year ${yearNumber} lunch changed successfully.`,

            configuration: {

                program:
                    normalizedProgram,

                year:
                    yearNumber,

                semesters:
                    semesters,

                lunchStart:
                    lunchStart,

                lunchEnd:
                    lunchEnd,

                lockedBy:
                    facultyId

            }

        });

    }


    catch (error) {

        // ====================================================
        // ROLLBACK
        // ====================================================

        if (connection) {

            try {

                await connection.rollback();

            }

            catch (rollbackError) {

                console.error(
                    "CHANGE LUNCH ROLLBACK ERROR:",
                    rollbackError
                );

            }

        }


        console.error(
            "CHANGE LUNCH ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to change lunch.",

            error:
                error.message

        });

    }


    finally {

        // ====================================================
        // RELEASE CONNECTION
        // ====================================================

        if (connection) {

            connection.release();

        }

    }

};



// ============================================================
// GET LUNCH CONFIGURATION BY PROGRAM + YEAR
// ============================================================

exports.getLunchConfiguration = async (req, res) => {

    try {

        const {
            program,
            year
        } = req.query;


        // ====================================================
        // VALIDATION
        // ====================================================

        if (
            !program ||
            !year
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Program and year are required."

            });

        }


        // ====================================================
        // NORMALIZE
        // ====================================================

        const normalizedProgram =
            String(program)
                .trim()
                .toUpperCase();

        const yearNumber =
            Number(year);


        // ====================================================
        // GET SEMESTERS
        // ====================================================

        const semesters =
            getSemesters(
                normalizedProgram,
                yearNumber
            );


        if (!semesters) {

            return res.status(400).json({

                success: false,

                message:
                    `Invalid year ${yearNumber} for ${normalizedProgram}.`

            });

        }


        // ====================================================
        // QUERY
        // ====================================================

        const placeholders =
            semesters
                .map(() => "?")
                .join(",");


        const sql = `

            SELECT

                id,

                program,

                semester,

                TIME_FORMAT(
                    lunch_start,
                    '%H:%i:%s'
                ) AS lunchStart,

                TIME_FORMAT(
                    lunch_end,
                    '%H:%i:%s'
                ) AS lunchEnd,

                locked_by AS lockedBy,

                locked_at AS lockedAt

            FROM timetable_configurations

            WHERE department IS NULL

            AND program = ?

            AND semester IN (${placeholders})

            ORDER BY semester

        `;


        const [results] =
            await db.query(
                sql,
                [
                    normalizedProgram,
                    ...semesters
                ]
            );


        // ====================================================
        // NOT LOCKED
        // ====================================================

        if (results.length === 0) {

            return res.json({

                success: true,

                locked: false,

                program:
                    normalizedProgram,

                year:
                    yearNumber,

                semesters:
                    semesters,

                configuration:
                    null

            });

        }


        // ====================================================
        // LOCKED
        // ====================================================

        return res.json({

            success: true,

            locked:
                results.length === semesters.length,

            program:
                normalizedProgram,

            year:
                yearNumber,

            semesters:
                semesters,

            configuration:
                results

        });

    }


    catch (error) {

        console.error(
            "GET LUNCH CONFIGURATION ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to get lunch configuration.",

            error:
                error.message

        });

    }

};



// ============================================================
// GET ALL LOCKED LUNCH CONFIGURATIONS
// ADMIN DASHBOARD
// ============================================================

exports.getAllLunchConfigurations = async (req, res) => {

    try {

        const sql = `

            SELECT

                id,

                program,

                semester,

                TIME_FORMAT(
                    lunch_start,
                    '%H:%i:%s'
                ) AS lunchStart,

                TIME_FORMAT(
                    lunch_end,
                    '%H:%i:%s'
                ) AS lunchEnd,

                locked_by AS lockedBy,

                locked_at AS lockedAt

            FROM timetable_configurations

            WHERE department IS NULL

            ORDER BY
                program,
                semester

        `;


        const [results] =
            await db.query(sql);


        return res.json({

            success: true,

            configurations:
                results

        });

    }


    catch (error) {

        console.error(
            "GET ALL LUNCH CONFIGURATIONS ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to get lunch configurations.",

            error:
                error.message

        });

    }

};

// ============================================================
// CHECK LUNCH FOR A PARTICULAR BATCH
// ============================================================

exports.getLunchForBatch = async (req, res) => {

    try {

        const { batchId, academicSessionStartYear } = req.query;


        if (!batchId || !academicSessionStartYear) {

            return res.status(400).json({
                success: false,
                message:
                    "batchId and academicSessionStartYear are required."
            });

        }


        // ====================================================
        // GET BATCH
        // ====================================================

        const batchSql = `

            SELECT
                id,
                batch_code,
                program,
                batch_type,
                enrollment_year,
                current_semester,
                department

            FROM batches

            WHERE id = ?

            LIMIT 1

        `;


        const [batchRows] =
            await db.query(
                batchSql,
                [Number(batchId)]
            );


        if (batchRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Batch not found."
            });

        }


        const batch = batchRows[0];


        let lunchProgram;
        let lunchSemesters;
        let calculatedYear;


        // ====================================================
        // BTECH INTEGRATED
        // ====================================================

        if (
            batch.program === 'BTECH' &&
            batch.batch_type === 'Integrated'
        ) {

            calculatedYear =
                Number(academicSessionStartYear) -
                Number(batch.enrollment_year) +
                1;


            // Integrated Year 1
            // → BTECH Sem 1,2

            if (calculatedYear === 1) {

                lunchProgram = 'BTECH';
                lunchSemesters = [1, 2];

            }


            // Integrated Year 2
            // → BTECH Sem 3,4

            else if (calculatedYear === 2) {

                lunchProgram = 'BTECH';
                lunchSemesters = [3, 4];

            }


            // Integrated Year 3
            // → BTECH Sem 5,6

            else if (calculatedYear === 3) {

                lunchProgram = 'BTECH';
                lunchSemesters = [5, 6];

            }


            // Integrated Year 4
            // → MTECH Year 1
            // → MTECH Sem 1,2

            else if (calculatedYear === 4) {

                lunchProgram = 'MTECH';
                lunchSemesters = [1, 2];

            }


            // Integrated Year 5
            // → MTECH Year 2
            // → MTECH Sem 3,4

            else if (calculatedYear === 5) {

                lunchProgram = 'MTECH';
                lunchSemesters = [3, 4];

            }


            else {

                return res.json({

                    success: true,

                    locked: false,

                    batch: batch,

                    integratedYear:
                        calculatedYear,

                    message:
                        "Batch is outside the configured Integrated M.Tech years."

                });

            }

        }


        // ====================================================
        // NORMAL BTECH
        // ====================================================

        else if (
            batch.program === 'BTECH'
        ) {

            calculatedYear =
                Math.ceil(
                    Number(batch.current_semester) / 2
                );


            lunchProgram = 'BTECH';


            lunchSemesters = [
                (calculatedYear * 2) - 1,
                calculatedYear * 2
            ];

        }


        // ====================================================
        // NORMAL MTECH
        // ====================================================

        else if (
            batch.program === 'MTECH'
        ) {

            calculatedYear =
                Math.ceil(
                    Number(batch.current_semester) / 2
                );


            lunchProgram = 'MTECH';


            lunchSemesters = [
                (calculatedYear * 2) - 1,
                calculatedYear * 2
            ];

        }


        else {

            return res.status(400).json({

                success: false,

                message:
                    "Unsupported batch program."

            });

        }


        // ====================================================
        // CHECK LUNCH
        // ====================================================

        const placeholders =
            lunchSemesters
                .map(() => '?')
                .join(',');


        const lunchSql = `

            SELECT

                id,
                program,
                semester,

                TIME_FORMAT(
                    lunch_start,
                    '%H:%i:%s'
                ) AS lunchStart,

                TIME_FORMAT(
                    lunch_end,
                    '%H:%i:%s'
                ) AS lunchEnd,

                locked_by AS lockedBy,

                locked_at AS lockedAt

            FROM timetable_configurations

            WHERE program = ?

            AND semester IN (${placeholders})

            ORDER BY semester

        `;


        const [lunchRows] =
            await db.query(
                lunchSql,
                [
                    lunchProgram,
                    ...lunchSemesters
                ]
            );


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.json({

            success: true,

            locked:
                lunchRows.length ===
                lunchSemesters.length,

            batch: {

                id:
                    batch.id,

                batchCode:
                    batch.batch_code,

                program:
                    batch.program,

                batchType:
                    batch.batch_type,

                enrollmentYear:
                    batch.enrollment_year

            },

            integratedYear:
                calculatedYear,

            lunchSource: {

                program:
                    lunchProgram,

                semesters:
                    lunchSemesters

            },

            configuration:
                lunchRows

        });

    }


    catch (error) {

        console.error(
            "GET LUNCH FOR BATCH ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to determine lunch for batch.",

            error:
                error.message

        });

    }

};