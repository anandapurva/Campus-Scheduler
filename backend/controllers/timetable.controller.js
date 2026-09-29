const db = require('../config/db');

// ======================================================
// TIMETABLE CELL ROOM
// ======================================================

function getTimetableCellRoom(
    academicSessionId,
    day,
    slotId
) {
    return `timetable:${academicSessionId}:${day}:${slotId}`;
}


// ======================================================
// CREATE TIMETABLE ENTRY
// ======================================================

exports.createTimetableEntry = async (req, res) => {

    const connection = await db.getConnection();

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
        // NORMALIZE VALUES
        // ==================================================

        const sessionId = Number(academicSessionId);
        const program = Number(programId);
        const department = Number(departmentId);
        const semester = Number(semesterId);
        const slot = Number(slotId);
        const subject = Number(subjectId);
        const room = Number(roomId);

        const batches = Array.isArray(batchIds)
            ? batchIds.map(id => Number(id))
            : [];

        const teachers = Array.isArray(teacherIds)
            ? teacherIds.map(id => Number(id))
            : [];

        const students = Number(totalStudents || 0);


        // ==================================================
        // VALIDATION
        // ==================================================

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Academic session is required.'
            });
        }

        if (!program) {
            return res.status(400).json({
                success: false,
                message: 'Program is required.'
            });
        }

        if (!department) {
            return res.status(400).json({
                success: false,
                message: 'Department is required.'
            });
        }

        if (!semester) {
            return res.status(400).json({
                success: false,
                message: 'Semester is required.'
            });
        }

        if (!day) {
            return res.status(400).json({
                success: false,
                message: 'Day is required.'
            });
        }

        if (!slot) {
            return res.status(400).json({
                success: false,
                message: 'Time slot is required.'
            });
        }

        if (!subject) {
            return res.status(400).json({
                success: false,
                message: 'Subject is required.'
            });
        }

        if (!lectureType) {
            return res.status(400).json({
                success: false,
                message: 'Lecture type is required.'
            });
        }

        if (!room) {
            return res.status(400).json({
                success: false,
                message: 'Room is required.'
            });
        }

        if (batches.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one batch is required.'
            });
        }


        // ==================================================
        // START TRANSACTION
        // ==================================================

        await connection.beginTransaction();


        // ==================================================
        // ROOM CONFLICT
        // ==================================================

        const [roomConflict] = await connection.query(
            `
            SELECT
                te.id
            FROM timetable_entries te
            WHERE
                te.academic_session_id = ?
                AND te.day = ?
                AND te.slot_id = ?
                AND te.room_id = ?
            LIMIT 1
            `,
            [
                sessionId,
                day,
                slot,
                room
            ]
        );


        if (roomConflict.length > 0) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    'Room is already booked for this time slot.'
            });
        }


        // ==================================================
        // FACULTY CONFLICT
        // ==================================================

        if (teachers.length > 0) {

            const [facultyConflict] =
                await connection.query(
                    `
                    SELECT
                        f.id,
                        f.name,
                        f.abbreviation

                    FROM timetable_entry_faculty tef

                    INNER JOIN timetable_entries te
                        ON te.id = tef.timetable_entry_id

                    INNER JOIN faculty f
                        ON f.id = tef.faculty_id

                    WHERE
                        te.academic_session_id = ?
                        AND te.day = ?
                        AND te.slot_id = ?
                        AND tef.faculty_id IN (?)

                    LIMIT 1
                    `,
                    [
                        sessionId,
                        day,
                        slot,
                        teachers
                    ]
                );


            if (facultyConflict.length > 0) {

                await connection.rollback();

                const faculty =
                    facultyConflict[0];

                return res.status(409).json({
                    success: false,
                    message:
                        `Faculty ${faculty.name} is already teaching during this time slot.`
                });
            }
        }


        // ==================================================
        // BATCH CONFLICT
        // ==================================================

        const [batchConflict] =
            await connection.query(
                `
                SELECT
                    b.id,
                    b.batch_code

                FROM timetable_entry_batches teb

                INNER JOIN timetable_entries te
                    ON te.id = teb.timetable_entry_id

                INNER JOIN batches b
                    ON b.id = teb.batch_id

                WHERE
                    te.academic_session_id = ?
                    AND te.day = ?
                    AND te.slot_id = ?
                    AND teb.batch_id IN (?)

                LIMIT 1
                `,
                [
                    sessionId,
                    day,
                    slot,
                    batches
                ]
            );


        if (batchConflict.length > 0) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    `Batch ${batchConflict[0].batch_code} is already scheduled during this time slot.`
            });
        }


        // ==================================================
        // INSERT MAIN TIMETABLE ENTRY
        // ==================================================

        const [entryResult] =
            await connection.query(
                `
                INSERT INTO timetable_entries
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
                )
                `,
                [
                    sessionId,

                    program,
                    department,
                    semester,

                    day,

                    slot,
                    startTime,
                    endTime,

                    subject,

                    lectureType,

                    room,

                    students
                ]
            );


        const timetableEntryId =
            entryResult.insertId;


        // ==================================================
        // INSERT BATCHES
        // ==================================================

        for (const batchId of batches) {

            await connection.query(
                `
                INSERT INTO timetable_entry_batches
                (
                    timetable_entry_id,
                    batch_id
                )

                VALUES (?, ?)
                `,
                [
                    timetableEntryId,
                    batchId
                ]
            );
        }


        // ==================================================
        // INSERT FACULTY
        // ==================================================

        for (const facultyId of teachers) {

            await connection.query(
                `
                INSERT INTO timetable_entry_faculty
                (
                    timetable_entry_id,
                    faculty_id
                )

                VALUES (?, ?)
                `,
                [
                    timetableEntryId,
                    facultyId
                ]
            );
        }


        // ==================================================
        // COMMIT TRANSACTION
        // ==================================================

        await connection.commit();


        // ==================================================
        // REAL-TIME RESOURCE LOCK UPDATE
        // ==================================================

        const io = req.app.get('io');

        if (io) {

            const roomName =
                getTimetableCellRoom(
                    sessionId,
                    day,
                    slot
                );


            io.to(roomName).emit(
                'resource-lock-updated',
                {
                    academicSessionId:
                        sessionId,

                    day,

                    slotId:
                        slot,

                    timetableEntryId:
                        timetableEntryId
                }
            );
        }


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

        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error(
                'ROLLBACK ERROR:',
                rollbackError
            );
        }


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
                `
                SELECT

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
                    te.slot_id
                `,
                [
                    academicSessionId,
                    programId,
                    departmentId,
                    semesterId
                ]
            );


        // ==================================================
        // LOAD BATCHES + TEACHERS
        // ==================================================

        for (const entry of entries) {

            // ==================================================
            // BATCHES
            // ==================================================

            const [batches] =
                await db.query(
                    `
                    SELECT

                        b.id,
                        b.batch_code,
                        b.program,
                        b.batch_type,
                        b.enrollment_year,
                        b.department

                    FROM timetable_entry_batches teb

                    INNER JOIN batches b
                        ON b.id = teb.batch_id

                    WHERE
                        teb.timetable_entry_id = ?
                    `,
                    [
                        entry.id
                    ]
                );


            entry.batches = batches;


            // ==================================================
            // TEACHERS
            // ==================================================

            const [teachers] =
                await db.query(
                    `
                    SELECT

                        f.id,
                        f.name,
                        f.abbreviation,
                        f.department

                    FROM timetable_entry_faculty tef

                    INNER JOIN faculty f
                        ON f.id = tef.faculty_id

                    WHERE
                        tef.timetable_entry_id = ?
                    `,
                    [
                        entry.id
                    ]
                );


            entry.teachers = teachers;
        }


        // ==================================================
        // RESPONSE
        // ==================================================

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


// ======================================================
// GET LOCKED RESOURCES FOR TIMETABLE CELL
// ======================================================

exports.getLockedResources = async (req, res) => {

    try {

        const {
            academicSessionId,
            day,
            slotId,
            excludeEntryId
        } = req.query;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (
            !academicSessionId ||
            !day ||
            !slotId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Academic session, day and slot are required.'

            });

        }


        const sessionId =
            Number(academicSessionId);

        const slot =
            Number(slotId);


        // ==================================================
        // ROOM LOCKS
        // ==================================================

        let roomQuery = `
            SELECT DISTINCT
                te.room_id

            FROM timetable_entries te

            WHERE
                te.academic_session_id = ?
                AND te.day = ?
                AND te.slot_id = ?
        `;


        const roomParams = [
            sessionId,
            day,
            slot
        ];


        if (excludeEntryId) {

            roomQuery += `
                AND te.id != ?
            `;

            roomParams.push(
                Number(excludeEntryId)
            );
        }


        const [rooms] =
            await db.query(
                roomQuery,
                roomParams
            );


        // ==================================================
        // FACULTY LOCKS
        // ==================================================

        let facultyQuery = `
            SELECT DISTINCT
                tef.faculty_id

            FROM timetable_entry_faculty tef

            INNER JOIN timetable_entries te
                ON te.id = tef.timetable_entry_id

            WHERE
                te.academic_session_id = ?
                AND te.day = ?
                AND te.slot_id = ?
        `;


        const facultyParams = [
            sessionId,
            day,
            slot
        ];


        if (excludeEntryId) {

            facultyQuery += `
                AND te.id != ?
            `;

            facultyParams.push(
                Number(excludeEntryId)
            );
        }


        const [faculty] =
            await db.query(
                facultyQuery,
                facultyParams
            );


        // ==================================================
        // BATCH LOCKS
        // ==================================================

        let batchQuery = `
            SELECT DISTINCT
                teb.batch_id

            FROM timetable_entry_batches teb

            INNER JOIN timetable_entries te
                ON te.id = teb.timetable_entry_id

            WHERE
                te.academic_session_id = ?
                AND te.day = ?
                AND te.slot_id = ?
        `;


        const batchParams = [
            sessionId,
            day,
            slot
        ];


        if (excludeEntryId) {

            batchQuery += `
                AND te.id != ?
            `;

            batchParams.push(
                Number(excludeEntryId)
            );
        }


        const [batches] =
            await db.query(
                batchQuery,
                batchParams
            );


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.json({

            success: true,

            roomIds:
                rooms.map(
                    row => Number(row.room_id)
                ),

            facultyIds:
                faculty.map(
                    row => Number(row.faculty_id)
                ),

            batchIds:
                batches.map(
                    row => Number(row.batch_id)
                )

        });


    } catch (error) {

        console.error(
            'GET LOCKED RESOURCES ERROR:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Failed to load locked resources.',

            error:
                error.message

        });

    }

};