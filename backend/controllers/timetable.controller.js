const db = require('../config/db');
// ======================================================
// CREATE TIMETABLE ENTRY
// ======================================================

exports.createTimetableEntry = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        const {

            academicSessionId,

            programId,
            departmentId,
            semesterId,

            day,

            slotId,
            startTime,
            endTime,

            subjectId,

            lectureType,

            roomId,

            batchIds,
            teacherIds,

            totalStudents

        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (!academicSessionId) {

            return res.status(400).json({
                success: false,
                message:
                    'Academic session is required.'
            });

        }


        if (!programId) {

            return res.status(400).json({
                success: false,
                message:
                    'Program is required.'
            });

        }


        if (!departmentId) {

            return res.status(400).json({
                success: false,
                message:
                    'Department is required.'
            });

        }


        if (!semesterId) {

            return res.status(400).json({
                success: false,
                message:
                    'Semester is required.'
            });

        }


        if (!day) {

            return res.status(400).json({
                success: false,
                message:
                    'Day is required.'
            });

        }


        if (!slotId) {

            return res.status(400).json({
                success: false,
                message:
                    'Time slot is required.'
            });

        }


        if (!subjectId) {

            return res.status(400).json({
                success: false,
                message:
                    'Subject is required.'
            });

        }


        if (!lectureType) {

            return res.status(400).json({
                success: false,
                message:
                    'Lecture type is required.'
            });

        }


        if (!roomId) {

            return res.status(400).json({
                success: false,
                message:
                    'Room is required.'
            });

        }


        if (
            !Array.isArray(batchIds) ||
            batchIds.length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'At least one batch is required.'
            });

        }


        // ==================================================
        // START TRANSACTION
        // ==================================================

        await connection.beginTransaction();


        // ==================================================
        // INSERT MAIN TIMETABLE ENTRY
        // ==================================================

        const [entryResult] =
            await connection.query(

                `INSERT INTO timetable_entries
                (
                    academic_session_id,

                    program_id,
                    department_id,
                    semester_id,

                    day,

                    slot_id,
                    start_time,
                    end_time,

                    subject_id,

                    lecture_type,

                    room_id,

                    total_students
                )

                VALUES
                (
                    ?, ?, ?, ?,
                    ?,
                    ?, ?, ?,
                    ?,
                    ?,
                    ?,
                    ?
                )`,

                [

                    academicSessionId,

                    programId,
                    departmentId,
                    semesterId,

                    day,

                    slotId,
                    startTime,
                    endTime,

                    subjectId,

                    lectureType,

                    roomId,

                    totalStudents || 0

                ]

            );


        const timetableEntryId =
            entryResult.insertId;


        // ==================================================
        // INSERT BATCHES
        // ==================================================

        for (
            const batchId of batchIds
        ) {

            await connection.query(

                `INSERT INTO
                    timetable_entry_batches
                (
                    timetable_entry_id,
                    batch_id
                )
                VALUES (?, ?)`,

                [
                    timetableEntryId,
                    batchId
                ]

            );

        }


        // ==================================================
        // INSERT FACULTY
        // ==================================================

        if (
            Array.isArray(teacherIds)
        ) {

            for (
                const facultyId of teacherIds
            ) {

                await connection.query(

                    `INSERT INTO
                        timetable_entry_faculty
                    (
                        timetable_entry_id,
                        faculty_id
                    )
                    VALUES (?, ?)`,

                    [
                        timetableEntryId,
                        facultyId
                    ]

                );

            }

        }


        // ==================================================
        // COMMIT
        // ==================================================

        await connection.commit();


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.status(201).json({

            success: true,

            message:
                'Timetable entry created successfully.',

            timetableEntryId:
                timetableEntryId

        });


    } catch (error) {


        // ==================================================
        // ROLLBACK
        // ==================================================

        await connection.rollback();


        console.error(
            'CREATE TIMETABLE ERROR:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Failed to create timetable entry.',

            error:
                error.message

        });


    } finally {

        connection.release();

    }

};

// ======================================================
// GET TIMETABLE
// ======================================================

exports.getTimetable = async (req, res) => {

    try {

        const {

            academicSessionId,
            programId,
            departmentId,
            semesterId

        } = req.query;


        const [entries] =
            await db.query(

                `SELECT
                    te.id,

                    te.academic_session_id,

                    te.program_id,
                    te.department_id,
                    te.semester_id,

                    te.day,

                    te.slot_id,
                    te.start_time,
                    te.end_time,

                    te.subject_id,

                    s.course_code
                        AS subject_code,

                    s.subject_name,

                    te.lecture_type,

                    te.room_id,

                    r.room_id
                        AS room_code,

                    r.room_name,

                    r.room_type,

                    r.capacity
                        AS room_capacity,

                    te.total_students

                FROM timetable_entries te

                INNER JOIN subjects s
                    ON s.id = te.subject_id

                INNER JOIN rooms r
                    ON r.id = te.room_id

                WHERE
                    te.academic_session_id = ?
                    AND te.program_id = ?
                    AND te.department_id = ?
                    AND te.semester_id = ?

                ORDER BY
                    te.day,
                    te.slot_id`,

                [

                    academicSessionId,
                    programId,
                    departmentId,
                    semesterId

                ]

            );


        // ==================================================
        // LOAD BATCHES + TEACHERS FOR EACH ENTRY
        // ==================================================

        for (
            const entry of entries
        ) {


            const [batches] =
                await db.query(

                    `SELECT
                        b.id,
                        b.batch_code,
                        b.program,
                        b.batch_type,
                        b.enrollment_year,
                        b.department

                    FROM
                        timetable_entry_batches teb

                    INNER JOIN batches b
                        ON b.id = teb.batch_id

                    WHERE
                        teb.timetable_entry_id = ?`,

                    [
                        entry.id
                    ]

                );


            entry.batches =
                batches;


            const [teachers] =
                await db.query(

                    `SELECT
                        f.id,
                        f.name,
                        f.abbreviation,
                        f.department

                    FROM
                        timetable_entry_faculty tef

                    INNER JOIN faculty f
                        ON f.id = tef.faculty_id

                    WHERE
                        tef.timetable_entry_id = ?`,

                    [
                        entry.id
                    ]

                );


            entry.teachers =
                teachers;

        }


        return res.json({

            success: true,

            entries

        });


    } catch (error) {

        console.error(
            'GET TIMETABLE ERROR:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Failed to load timetable.',

            error:
                error.message

        });

    }

};