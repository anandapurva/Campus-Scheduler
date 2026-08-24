const db = require("../config/db");


// ======================================================
// LOCK LUNCH
// ======================================================
exports.lockLunch = async (req, res) => {

    try {

        const {
            department,
            program,
            semester,
            lunchStart,
            lunchEnd,
            facultyId
        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (
            !department ||
            !program ||
            !semester ||
            !lunchStart ||
            !lunchEnd ||
            !facultyId
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Department, program, semester, lunch and faculty ID are required."
            });

        }


        // ==================================================
        // NORMALIZE PROGRAM
        // ==================================================

        const normalizedProgram =
            program.toUpperCase();


        if (
            normalizedProgram !== "BTECH" &&
            normalizedProgram !== "MTECH" &&
            normalizedProgram !== "IMTECH"
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid program."
            });

        }


        // ==================================================
        // VALIDATE LUNCH
        // ==================================================

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


        const validLunch =
            allowedLunchSlots.some(
                lunch =>
                    lunch.start === lunchStart &&
                    lunch.end === lunchEnd
            );


        if (!validLunch) {

            return res.status(400).json({
                success: false,
                message: "Invalid lunch break."
            });

        }


        // ==================================================
        // CHECK IF ALREADY LOCKED
        // ==================================================

        const checkSql = `

            SELECT
                id,
                department,
                program,
                semester,
                lunch_start,
                lunch_end,
                locked_by,
                locked_at

            FROM timetable_configurations

            WHERE department = ?
            AND program = ?
            AND semester = ?

            LIMIT 1

        `;


        const [existingRows] = await db.query(
            checkSql,
            [
                department.trim(),
                normalizedProgram,
                Number(semester)
            ]
        );



        // ==================================================
        // ALREADY LOCKED
        // ==================================================

        if (existingRows.length > 0) {

            const existing =
                existingRows[0];


            return res.status(409).json({

                success: false,

                locked: true,

                message:
                    "Lunch break is already locked for this department, program and semester.",

                configuration: {

                    id:
                        existing.id,

                    department:
                        existing.department,

                    program:
                        existing.program,

                    semester:
                        existing.semester,

                    lunchStart:
                        existing.lunch_start,

                    lunchEnd:
                        existing.lunch_end,

                    lockedBy:
                        existing.locked_by,

                    lockedAt:
                        existing.locked_at

                }

            });

        }


        // ==================================================
        // INSERT
        // ==================================================


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

            VALUES (?, ?, ?, ?, ?, ?)

        `;


        const [result] = await db.query(
            insertSql,
            [
                department.trim(),
                normalizedProgram,
                Number(semester),
                lunchStart,
                lunchEnd,
                facultyId
            ]
        );



        // ==================================================
        // SUCCESS RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            locked: true,

            message:
                "Lunch break locked successfully.",

            configuration: {

                id:
                    result.insertId,

                department:
                    department.trim(),

                program:
                    normalizedProgram,

                semester:
                    Number(semester),

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

};



// ======================================================
// GET LOCKED LUNCH
// ======================================================

exports.getLunchConfiguration = async (req, res) => {

    try {

        const {
            department,
            program,
            semester
        } = req.query;


        if (
            !department ||
            !program ||
            !semester
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Department, program and semester are required."

            });

        }


        const sql = `

            SELECT

                id,
                department,
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

            WHERE department = ?
            AND program = ?
            AND semester = ?

            LIMIT 1

        `;


        const [results] = await db.query(
            sql,
            [
                department.trim(),
                program.toUpperCase(),
                Number(semester)
            ]
        );


        // ==================================================
        // NOT LOCKED
        // ==================================================

        if (results.length === 0) {

            return res.json({

                success: true,

                locked: false,

                configuration: null

            });

        }


        // ==================================================
        // LOCKED
        // ==================================================

        return res.json({

            success: true,

            locked: true,

            configuration:
                results[0]

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