const db = require("../config/db");

/*
============================================================
GET ALL TEACHERS
============================================================

Returns teachers grouped by department.

Special rule:
CSE & IT faculty are displayed under CSE.
They are NOT displayed under IT.
============================================================
*/

exports.getTeachers = async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                u.id,
                u.full_name,
                u.faculty_id,
                u.department,
                u.can_edit,
                f.abbreviation
            FROM users u

            LEFT JOIN faculty f
                ON f.faculty_id = u.faculty_id

            WHERE u.role = 'TEACHER'

            ORDER BY
                u.department ASC,
                f.abbreviation ASC,
                u.full_name ASC
        `);

        const departments = {};

        rows.forEach(teacher => {

            let department = teacher.department;

            /*
            CSE & IT → CSE
            */
            if (teacher.department === "CSE & IT") {
                department = "CSE";
            }

            if (!departments[department]) {
                departments[department] = [];
            }

            departments[department].push({
                id: teacher.id,
                faculty_id: teacher.faculty_id,
                name: teacher.full_name,
                abbreviation: teacher.abbreviation,
                department: teacher.department,
                can_edit: Number(teacher.can_edit) === 1
            });
        });

        res.status(200).json({
            success: true,
            departments: departments
        });

    } catch (error) {

        console.error("GET TEACHERS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load teachers",
            error: error.message
        });
    }
};


/*
============================================================
GRANT TT EDIT ACCESS
============================================================
*/

exports.grantEditAccess = async (req, res) => {

    try {

        const { user_ids } = req.body;

        if (!Array.isArray(user_ids) || user_ids.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Please select at least one teacher"
            });
        }

        await db.query(`
            UPDATE users
            SET can_edit = 1
            WHERE role = 'TEACHER'
            AND id IN (?)
        `, [user_ids]);

        res.status(200).json({
            success: true,
            message: "TT edit access granted successfully"
        });

    } catch (error) {

        console.error("GRANT EDIT ACCESS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to grant edit access",
            error: error.message
        });
    }
};


/*
============================================================
REVOKE TT EDIT ACCESS
============================================================
*/

exports.revokeEditAccess = async (req, res) => {

    try {

        const { user_id } = req.body;

        if (!user_id) {

            return res.status(400).json({
                success: false,
                message: "user_id is required"
            });
        }

        await db.query(`
            UPDATE users
            SET can_edit = 0
            WHERE id = ?
            AND role = 'TEACHER'
        `, [user_id]);

        res.status(200).json({
            success: true,
            message: "TT edit access removed successfully"
        });

    } catch (error) {

        console.error("REVOKE EDIT ACCESS ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Failed to remove edit access",
            error: error.message
        });
    }
};