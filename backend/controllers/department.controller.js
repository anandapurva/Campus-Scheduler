const db = require('../config/db');


// ==========================================
// GET ACTIVE DEPARTMENTS BY PROGRAM
// ==========================================


exports.getDepartmentsByProgram = async (req, res) => {

    try {

        const { programId } = req.query;

        if (!programId) {
            return res.status(400).json({
                message: "programId is required"
            });
        }

        const [departments] = await db.query(
            `
            SELECT
                d.id,
                d.name,
                d.abbreviation,
                d.is_active,
                GROUP_CONCAT(
                    DISTINCT p.program_name
                    ORDER BY p.program_name
                    SEPARATOR ', '
                ) AS program_names

            FROM departments d

            INNER JOIN program_departments pd
                ON pd.department_id = d.id

            INNER JOIN programs p
                ON p.id = pd.program_id

            WHERE pd.program_id = ?
              AND pd.is_active = 1

            GROUP BY
                d.id,
                d.name,
                d.abbreviation,
                d.is_active

            ORDER BY d.name
            `,
            [programId]
        );

        res.json(departments);

    } catch (error) {

        console.error(
            "Error fetching departments by program:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch departments by program"
        });

    }

};

// ==========================================
// GET ALL ACTIVE DEPARTMENTS
// ==========================================

exports.getAllDepartments = async (req, res) => {

    try {

        const [departments] = await db.query(
            `
            SELECT
                d.id,
                d.name,
                d.abbreviation,
                d.is_active,

                GROUP_CONCAT(
                    DISTINCT p.program_name
                    ORDER BY p.program_name
                    SEPARATOR ', '
                ) AS program_names

            FROM departments d

            LEFT JOIN program_departments pd
                ON pd.department_id = d.id
                AND pd.is_active = 1

            LEFT JOIN programs p
                ON p.id = pd.program_id

            GROUP BY
                d.id,
                d.name,
                d.abbreviation,
                d.is_active

            ORDER BY d.name
            `
        );

        return res.json(departments);

    } catch (error) {

        console.error(
            "Error fetching all departments:",
            error
        );

        return res.status(500).json({
            message: "Failed to fetch departments"
        });

    }

};


// ==========================================
// CREATE DEPARTMENT
// ==========================================

exports.createDepartment = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {
            name,
            abbreviation,
            programIds
        } = req.body;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (!name || !name.trim()) {

            return res.status(400).json({
                message: 'Department name is required'
            });

        }


        if (!abbreviation || !abbreviation.trim()) {

            return res.status(400).json({
                message: 'Department abbreviation is required'
            });

        }


        if (
            !Array.isArray(programIds) ||
            programIds.length === 0
        ) {

            return res.status(400).json({
                message: 'Please select at least one program'
            });

        }


        await connection.beginTransaction();


        // ==========================================
        // FIND EXISTING DEPARTMENT
        // ==========================================

        const [existingDepartment] =
            await connection.query(
                `
                SELECT
                    id,
                    name,
                    abbreviation,
                    is_active
                FROM departments
                WHERE LOWER(TRIM(name))
                    = LOWER(TRIM(?))
                LIMIT 1
                `,
                [name]
            );


        let departmentId;


        // ==========================================
        // DEPARTMENT ALREADY EXISTS
        // ==========================================

        if (existingDepartment.length > 0) {

            departmentId =
                existingDepartment[0].id;

        }

        // ==========================================
        // CREATE NEW DEPARTMENT
        // ==========================================

        else {

            const [departmentResult] =
                await connection.query(
                    `
                    INSERT INTO departments
                    (
                        name,
                        abbreviation,
                        is_active
                    )
                    VALUES (?, ?, 1)
                    `,
                    [
                        name.trim(),
                        abbreviation.trim()
                    ]
                );


            departmentId =
                departmentResult.insertId;

        }


        // ==========================================
        // ASSIGN PROGRAMS
        // ==========================================

        for (
            const programId of programIds
        ) {

            const numericProgramId =
                Number(programId);


            if (
                !numericProgramId ||
                Number.isNaN(numericProgramId)
            ) {

                continue;

            }


            // --------------------------------------
            // CHECK EXISTING PROGRAM RELATIONSHIP
            // --------------------------------------

            const [existingRelation] =
                await connection.query(
                    `
                    SELECT
                        id,
                        is_active
                    FROM program_departments
                    WHERE program_id = ?
                      AND department_id = ?
                    LIMIT 1
                    `,
                    [
                        numericProgramId,
                        departmentId
                    ]
                );


            // --------------------------------------
            // ALREADY ASSOCIATED
            // --------------------------------------

            if (existingRelation.length > 0) {

                // If relationship exists but is inactive,
                // activate it again.

                if (
                    Number(
                        existingRelation[0].is_active
                    ) !== 1
                ) {

                    await connection.query(
                        `
                        UPDATE program_departments
                        SET
                            is_active = 1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        `,
                        [
                            existingRelation[0].id
                        ]
                    );

                }

                else {

                    await connection.rollback();

                    return res.status(400).json({

                        message:
                            `Department "${name.trim()}" is already associated with this program.`

                    });

                }

            }

            // --------------------------------------
            // NEW PROGRAM RELATIONSHIP
            // --------------------------------------

            else {

                await connection.query(
                    `
                    INSERT INTO program_departments
                    (
                        program_id,
                        department_id,
                        is_active
                    )
                    VALUES (?, ?, 1)
                    `,
                    [
                        numericProgramId,
                        departmentId
                    ]
                );

            }

        }


        // ==========================================
        // COMMIT
        // ==========================================

        await connection.commit();


        return res.status(201).json({

            message:
                'Department created successfully',

            departmentId

        });


    } catch (error) {

        await connection.rollback();

        console.error(
            'Error creating department:',
            error
        );

        return res.status(500).json({

            message:
                'Failed to create department'

        });

    } finally {

        connection.release();

    }

};

// ==========================================
// UPDATE DEPARTMENT
// ==========================================

exports.updateDepartment = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        const { id } = req.params;

        const {
            name,
            abbreviation,
            programIds
        } = req.body;


        if (!name || !abbreviation) {

            return res.status(400).json({
                message:
                    'Department name and abbreviation are required'
            });

        }


        await connection.beginTransaction();


        // ------------------------------------------
        // CHECK DEPARTMENT
        // ------------------------------------------

        const [existing] =
            await connection.query(
                `
                SELECT id
                FROM departments
                WHERE id = ?
                `,
                [id]
            );

        if (existing.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                message:
                    'Department not found'
            });

        }


        // ------------------------------------------
        // UPDATE DEPARTMENT
        // ------------------------------------------

        await connection.query(
            `
            UPDATE departments
            SET
                name = ?,
                abbreviation = ?
            WHERE id = ?
            `,
            [
                name.trim(),
                abbreviation.trim(),
                id
            ]
        );


        // ------------------------------------------
        // RESET PROGRAM RELATIONS
        // ------------------------------------------

        await connection.query(
            `
            UPDATE program_departments
            SET
                is_active = 0
            WHERE department_id = ?
            `,
            [id]
        );


        // ------------------------------------------
        // ADD / REACTIVATE PROGRAM RELATIONS
        // ------------------------------------------

        if (
            Array.isArray(programIds)
        ) {

            for (
                const programId
                of programIds
            ) {

                await connection.query(
                    `
                    INSERT INTO program_departments
                    (
                        program_id,
                        department_id,
                        is_active
                    )
                    VALUES (?, ?, 1)

                    ON DUPLICATE KEY UPDATE
                        is_active = 1
                    `,
                    [
                        Number(programId),
                        Number(id)
                    ]
                );

            }

        }


        await connection.commit();


        res.json({
            message:
                'Department updated successfully'
        });

    } catch (error) {

        await connection.rollback();

        console.error(
            'Error updating department:',
            error
        );

        res.status(500).json({
            message:
                'Failed to update department'
        });

    } finally {

        connection.release();

    }

};


// ==========================================
// ACTIVATE / DEACTIVATE DEPARTMENT
// ==========================================

exports.updateDepartmentStatus = async (
    req,
    res
) => {

    try {

        const { id } = req.params;

        const {
            is_active
        } = req.body;


        const active =
            is_active === true ||
            Number(is_active) === 1
                ? 1
                : 0;


        const [result] =
            await db.query(
                `
                UPDATE departments
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
                    'Department not found'
            });

        }


        res.json({
            message:
                active === 1
                    ? 'Department activated successfully'
                    : 'Department deactivated successfully'
        });

    } catch (error) {

        console.error(
            'Error updating department status:',
            error
        );

        res.status(500).json({
            message:
                'Failed to update department status'
        });

    }

};

// ==========================================
// GET PROGRAMS FOR DEPARTMENT
// ==========================================

exports.getProgramsByDepartment = async (
    req,
    res
) => {

    try {

        const { departmentId } =
            req.params;


        const [rows] =
            await db.query(
                `
                SELECT
                    p.id,
                    p.program_name,
                    p.total_semesters

                FROM programs p

                INNER JOIN program_departments pd
                    ON pd.program_id = p.id

                WHERE pd.department_id = ?
                  AND pd.is_active = 1

                ORDER BY p.program_name
                `,
                [departmentId]
            );


        res.json(rows);

    } catch (error) {

        console.error(
            'Error fetching department programs:',
            error
        );

        res.status(500).json({
            message:
                'Failed to fetch department programs'
        });

    }

};