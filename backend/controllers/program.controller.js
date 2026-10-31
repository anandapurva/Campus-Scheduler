const db = require('../config/db');


// ==========================================
// GET ALL ACTIVE PROGRAMS
// ==========================================

exports.getPrograms = async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT
                id,
                program_name,
                total_semesters,
                is_active
            FROM programs
            WHERE is_active = 1
            ORDER BY id
        `);

        res.json(rows);

    } catch (error) {

        console.error(
            'Error fetching programs:',
            error
        );

        res.status(500).json({
            message: 'Failed to fetch programs'
        });

    }

};


// ==========================================
// GET ALL PROGRAMS
// Admin Management
// ==========================================

exports.getAllPrograms = async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT
                id,
                program_name,
                total_semesters,
                is_active
            FROM programs
            ORDER BY id
        `);

        res.json(rows);

    } catch (error) {

        console.error(
            'Error fetching all programs:',
            error
        );

        res.status(500).json({
            message: 'Failed to fetch programs'
        });

    }

};


// ==========================================
// GET SEMESTERS FOR PROGRAM
// ==========================================

exports.getSemestersByProgram = async (req, res) => {

    try {

        const { programId } = req.params;

        const [rows] = await db.query(`
            SELECT
                id,
                program_id,
                semester_number,
                semester_name,
                year
            FROM semesters
            WHERE program_id = ?
            ORDER BY semester_number
        `, [programId]);

        res.json(rows);

    } catch (error) {

        console.error(
            'Error fetching semesters:',
            error
        );

        res.status(500).json({
            message: 'Failed to fetch semesters'
        });

    }

};


// ==========================================
// ADD PROGRAM
// Automatically creates semesters
// ==========================================

exports.createProgram = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {
            program_name,
            total_semesters
        } = req.body;

        if (!program_name || !total_semesters) {

            return res.status(400).json({
                message:
                    'Program name and total semesters are required'
            });

        }

        const totalSemesters =
            Number(total_semesters);

        if (
            !Number.isInteger(totalSemesters) ||
            totalSemesters <= 0
        ) {

            return res.status(400).json({
                message:
                    'Total semesters must be a positive integer'
            });

        }

        await connection.beginTransaction();


        // ------------------------------------------
        // CHECK DUPLICATE PROGRAM
        // ------------------------------------------

        const [existing] =
            await connection.query(
                `
                SELECT id
                FROM programs
                WHERE program_name = ?
                `,
                [program_name.trim()]
            );

        if (existing.length > 0) {

            await connection.rollback();

            return res.status(400).json({
                message:
                    'Program already exists'
            });

        }


        // ------------------------------------------
        // CREATE PROGRAM
        // ------------------------------------------

        const [programResult] =
            await connection.query(
                `
                INSERT INTO programs
                (
                    program_name,
                    total_semesters,
                    is_active
                )
                VALUES (?, ?, 1)
                `,
                [
                    program_name.trim(),
                    totalSemesters
                ]
            );

        const programId =
            programResult.insertId;


        // ------------------------------------------
        // CREATE SEMESTERS AUTOMATICALLY
        // ------------------------------------------

        for (
            let semesterNumber = 1;
            semesterNumber <= totalSemesters;
            semesterNumber++
        ) {

            const year =
                Math.ceil(
                    semesterNumber / 2
                );

            await connection.query(
                `
                INSERT INTO semesters
                (
                    program_id,
                    semester_number,
                    semester_name,
                    year
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    programId,
                    semesterNumber,
                    `Semester ${semesterNumber}`,
                    year
                ]
            );

        }


        await connection.commit();


        res.status(201).json({

            message:
                'Program created successfully',

            program: {
                id: programId,
                program_name:
                    program_name.trim(),
                total_semesters:
                    totalSemesters
            }

        });

    } catch (error) {

        await connection.rollback();

        console.error(
            'Error creating program:',
            error
        );

        res.status(500).json({
            message:
                'Failed to create program'
        });

    } finally {

        connection.release();

    }

};


// ==========================================
// UPDATE PROGRAM
// ==========================================

exports.updateProgram = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;

        const {
            program_name,
            total_semesters
        } = req.body;

        if (!program_name || !total_semesters) {

            return res.status(400).json({
                message:
                    'Program name and total semesters are required'
            });

        }

        const totalSemesters =
            Number(total_semesters);

        if (
            !Number.isInteger(totalSemesters) ||
            totalSemesters <= 0
        ) {

            return res.status(400).json({
                message:
                    'Total semesters must be a positive integer'
            });

        }

        await connection.beginTransaction();


        // ------------------------------------------
        // CHECK PROGRAM
        // ------------------------------------------

        const [programs] =
            await connection.query(
                `
                SELECT *
                FROM programs
                WHERE id = ?
                `,
                [id]
            );

        if (programs.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                message:
                    'Program not found'
            });

        }


        // ------------------------------------------
        // CHECK DUPLICATE NAME
        // ------------------------------------------

        const [duplicate] =
            await connection.query(
                `
                SELECT id
                FROM programs
                WHERE program_name = ?
                AND id != ?
                `,
                [
                    program_name.trim(),
                    id
                ]
            );

        if (duplicate.length > 0) {

            await connection.rollback();

            return res.status(400).json({
                message:
                    'Another program with this name already exists'
            });

        }


        // ------------------------------------------
        // UPDATE PROGRAM
        // ------------------------------------------

        await connection.query(
            `
            UPDATE programs
            SET
                program_name = ?,
                total_semesters = ?
            WHERE id = ?
            `,
            [
                program_name.trim(),
                totalSemesters,
                id
            ]
        );


        // ------------------------------------------
        // GET EXISTING SEMESTERS
        // ------------------------------------------

        const [existingSemesters] =
            await connection.query(
                `
                SELECT
                    id,
                    semester_number
                FROM semesters
                WHERE program_id = ?
                ORDER BY semester_number
                `,
                [id]
            );


        // ------------------------------------------
        // ADD MISSING SEMESTERS
        // ------------------------------------------

        for (
            let semesterNumber = 1;
            semesterNumber <= totalSemesters;
            semesterNumber++
        ) {

            const exists =
                existingSemesters.some(
                    semester =>
                        Number(
                            semester.semester_number
                        ) === semesterNumber
                );

            if (!exists) {

                const year =
                    Math.ceil(
                        semesterNumber / 2
                    );

                await connection.query(
                    `
                    INSERT INTO semesters
                    (
                        program_id,
                        semester_number,
                        semester_name,
                        year
                    )
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        id,
                        semesterNumber,
                        `Semester ${semesterNumber}`,
                        year
                    ]
                );

            }

        }


        // ------------------------------------------
        // REMOVE EXTRA SEMESTERS
        //
        // Only remove semester definitions that
        // are beyond the new total.
        // ------------------------------------------

        await connection.query(
            `
            DELETE FROM semesters
            WHERE program_id = ?
            AND semester_number > ?
            `,
            [
                id,
                totalSemesters
            ]
        );


        await connection.commit();


        res.json({
            message:
                'Program updated successfully'
        });

    } catch (error) {

        await connection.rollback();

        console.error(
            'Error updating program:',
            error
        );

        res.status(500).json({
            message:
                'Failed to update program'
        });

    } finally {

        connection.release();

    }

};


// ==========================================
// ACTIVATE / DEACTIVATE PROGRAM
// ==========================================

exports.updateProgramStatus = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            is_active
        } = req.body;

        if (
            is_active !== 0 &&
            is_active !== 1 &&
            is_active !== true &&
            is_active !== false
        ) {

            return res.status(400).json({
                message:
                    'is_active must be 0 or 1'
            });

        }

        const active =
            is_active === true ||
            Number(is_active) === 1
                ? 1
                : 0;

        const [result] =
            await db.query(
                `
                UPDATE programs
                SET is_active = ?
                WHERE id = ?
                `,
                [
                    active,
                    id
                ]
            );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                message:
                    'Program not found'
            });

        }

        res.json({
            message:
                active === 1
                    ? 'Program activated successfully'
                    : 'Program deactivated successfully'
        });

    } catch (error) {

        console.error(
            'Error updating program status:',
            error
        );

        res.status(500).json({
            message:
                'Failed to update program status'
        });

    }

};