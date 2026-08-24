const db = require("../config/db");

// ==========================================
// GET DEPARTMENTS BY PROGRAM
// ==========================================

exports.getDepartmentsByProgram = async (req, res) => {

    try {

        const { program } = req.query;

        if (!program) {
            return res.status(400).json({
                message: "program is required"
            });
        }

        const [departments] = await db.query(
            `
            SELECT
                d.id,
                d.name,
                d.abbreviation

            FROM departments d

            INNER JOIN program_departments pd
                ON pd.department_id = d.id

            INNER JOIN programs p
                ON p.id = pd.program_id

            WHERE p.program_name = ?
              AND p.is_active = 1
              AND pd.is_active = 1
              AND d.is_active = 1

            ORDER BY d.name
            `,
            [program]
        );

        res.json(departments);

    } catch (error) {

        console.error(
            "Error fetching departments:",
            error
        );

        res.status(500).json({
            message: "Failed to fetch departments"
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
                id,
                name,
                abbreviation

            FROM departments

            WHERE is_active = 1

            ORDER BY name
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