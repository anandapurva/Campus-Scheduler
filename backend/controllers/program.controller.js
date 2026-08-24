const db = require('../config/db');


// ==========================================
// GET ALL PROGRAMS
// ==========================================

exports.getPrograms = async (req, res) => {

    try {

        const [rows] = await db.query(`
            SELECT
                id,
                program_name,
                total_semesters
            FROM programs
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
                semester_name
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