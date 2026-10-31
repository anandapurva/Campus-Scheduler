const pool = require('../config/db');

// Get all academic sessions
const getAllAcademicSessions = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                session_name,
                start_year,
                end_year,
                is_active,
                created_at
            FROM academic_sessions
            ORDER BY start_year DESC
        `);

        res.json({
            success: true,
            sessions: rows
        });
    } catch (error) {
        console.error('Error fetching academic sessions:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch academic sessions'
        });
    }
};


// Get currently active academic session
const getActiveAcademicSession = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                session_name,
                start_year,
                end_year,
                is_active
            FROM academic_sessions
            WHERE is_active = TRUE
            LIMIT 1
        `);

        if (rows.length === 0) {
            return res.json({
                success: true,
                active: false,
                session: null
            });
        }

        res.json({
            success: true,
            active: true,
            session: rows[0]
        });
    } catch (error) {
        console.error('Error fetching active academic session:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch active academic session'
        });
    }
};


// Add academic session
const addAcademicSession = async (req, res) => {
    try {
        const {
            session_name,
            start_year,
            end_year
        } = req.body;

        if (!session_name || !start_year || !end_year) {
            return res.status(400).json({
                success: false,
                message: 'Session name, start year and end year are required'
            });
        }

        const startYear = Number(start_year);
        const endYear = Number(end_year);

        if (
            !Number.isInteger(startYear) ||
            !Number.isInteger(endYear) ||
            endYear !== startYear + 1
        ) {
            return res.status(400).json({
                success: false,
                message: 'End year must be exactly one year after start year'
            });
        }

        const [result] = await pool.query(`
            INSERT INTO academic_sessions
            (
                session_name,
                start_year,
                end_year,
                is_active
            )
            VALUES (?, ?, ?, FALSE)
        `, [
            session_name.trim(),
            startYear,
            endYear
        ]);

        res.status(201).json({
            success: true,
            message: 'Academic session added successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error adding academic session:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'This academic session already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to add academic session'
        });
    }
};


// Activate one academic session
const activateAcademicSession = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const sessionId = Number(req.params.id);

        if (!Number.isInteger(sessionId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid academic session ID'
            });
        }

        await connection.beginTransaction();

        // Deactivate all sessions
        await connection.query(`
            UPDATE academic_sessions
            SET is_active = FALSE
        `);

        // Activate selected session
        const [result] = await connection.query(`
            UPDATE academic_sessions
            SET is_active = TRUE
            WHERE id = ?
        `, [sessionId]);

        if (result.affectedRows === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Academic session activated successfully'
        });
    } catch (error) {
        await connection.rollback();

        console.error('Error activating academic session:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to activate academic session'
        });
    } finally {
        connection.release();
    }
};


// Deactivate all academic sessions
const deactivateAllAcademicSessions = async (req, res) => {
    try {
        await pool.query(`
            UPDATE academic_sessions
            SET is_active = FALSE
        `);

        res.json({
            success: true,
            message: 'All academic sessions deactivated'
        });
    } catch (error) {
        console.error('Error deactivating academic sessions:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to deactivate academic sessions'
        });
    }
};


module.exports = {
    getAllAcademicSessions,
    getActiveAcademicSession,
    addAcademicSession,
    activateAcademicSession,
    deactivateAllAcademicSessions
};