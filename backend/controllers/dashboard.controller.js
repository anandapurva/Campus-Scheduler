const db = require('../config/db');


// ==================================================
// GET DASHBOARD STATISTICS
// ==================================================

exports.getDashboardStats = async (req, res) => {

    try {

        const [programs] = await db.query(`
            SELECT COUNT(*) AS count
            FROM programs
            WHERE is_active = 1
        `);

        const [batches] = await db.query(`
            SELECT COUNT(*) AS count
            FROM batches
        `);

        const [rooms] = await db.query(`
            SELECT COUNT(*) AS count
            FROM rooms
        `);

        const [faculty] = await db.query(`
            SELECT COUNT(*) AS count
            FROM faculty
        `);

        return res.json({
            success: true,
            programs: Number(programs[0].count),
            batches: Number(batches[0].count),
            rooms: Number(rooms[0].count),
            faculty: Number(faculty[0].count)
        });

    } catch (err) {

        console.error(
            'Failed to load dashboard statistics:',
            err
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to load dashboard statistics',
            error: err.message
        });

    }

};