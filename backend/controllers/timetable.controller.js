const db = require('../config/db');
const { validateTimetableCompletion } = require('../services/timetableValidationService');

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
            roomIds,
            batchIds,
            teacherIds,
            totalStudents
        } = req.body;

        const sessionId = Number(academicSessionId);
        const program = Number(programId);
        const department = Number(departmentId);
        const semester = Number(semesterId);
        const slot = Number(slotId);
        const subject = Number(subjectId);
        const type = String(lectureType || '').toUpperCase();

        // Support both the new roomIds array and the old roomId field.
        const rooms = [
            ...new Set(
                (Array.isArray(roomIds) && roomIds.length
                    ? roomIds
                    : roomId != null ? [roomId] : []
                )
                .map(Number)
                .filter(id => Number.isInteger(id) && id > 0)
            )
        ];

        const batches = Array.isArray(batchIds)
            ? [...new Set(batchIds.map(Number).filter(id => id > 0))]
            : [];

        const teachers = Array.isArray(teacherIds)
            ? [...new Set(teacherIds.map(Number).filter(id => id > 0))]
            : [];

        const students = Number(totalStudents || 0);

        if (
            !sessionId || !program || !department || !semester ||
            !slot || !subject || !day || !['L', 'T', 'P'].includes(type)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Required timetable fields are missing.'
            });
        }

        if (rooms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one room or lab is required.'
            });
        }

        if (type !== 'P' && rooms.length !== 1) {
            return res.status(400).json({
                success: false,
                message: 'Lecture and tutorial classes must have exactly one room.'
            });
        }

        if (batches.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one batch is required.'
            });
        }

        await connection.beginTransaction();

        // Verify that all selected rooms exist.
        const [validRooms] = await connection.query(
            `SELECT id FROM rooms WHERE id IN (?)`,
            [rooms]
        );

        if (validRooms.length !== rooms.length) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'One or more selected rooms are invalid.'
            });
        }

        // Check room conflicts, including rooms stored in the mapping table.
        const [roomConflict] = await connection.query(
            `
            SELECT DISTINCT te.id
            FROM timetable_entries te
            LEFT JOIN timetable_entry_rooms ter
                ON ter.timetable_entry_id = te.id
            WHERE te.academic_session_id = ?
              AND te.day = ?
              AND te.slot_id = ?
              AND (
                    te.room_id IN (?)
                    OR ter.room_id IN (?)
              )
            LIMIT 1
            `,
            [sessionId, day, slot, rooms, rooms]
        );

        if (roomConflict.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: 'One or more selected rooms are already booked for this time slot.'
            });
        }

        // Faculty conflict.
        if (teachers.length > 0) {
            const [facultyConflict] = await connection.query(
                `
                SELECT f.name
                FROM timetable_entry_faculty tef
                INNER JOIN timetable_entries te
                    ON te.id = tef.timetable_entry_id
                INNER JOIN faculty f
                    ON f.id = tef.faculty_id
                WHERE te.academic_session_id = ?
                  AND te.day = ?
                  AND te.slot_id = ?
                  AND tef.faculty_id IN (?)
                LIMIT 1
                `,
                [sessionId, day, slot, teachers]
            );

            if (facultyConflict.length > 0) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: `Faculty ${facultyConflict[0].name} is already teaching during this time slot.`
                });
            }
        }

        // Batch conflict.
        const [batchConflict] = await connection.query(
            `
            SELECT b.batch_code
            FROM timetable_entry_batches teb
            INNER JOIN timetable_entries te
                ON te.id = teb.timetable_entry_id
            INNER JOIN batches b
                ON b.id = teb.batch_id
            WHERE te.academic_session_id = ?
              AND te.day = ?
              AND te.slot_id = ?
              AND teb.batch_id IN (?)
            LIMIT 1
            `,
            [sessionId, day, slot, batches]
        );

        if (batchConflict.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: `Batch ${batchConflict[0].batch_code} is already scheduled during this time slot.`
            });
        }

        // Keep the first room in the existing room_id column.
        const [entryResult] = await connection.query(
            `
            INSERT INTO timetable_entries (
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                type,
                rooms[0],
                students
            ]
        );

        const timetableEntryId = entryResult.insertId;

        // Save every selected room/lab.
        for (const selectedRoomId of rooms) {
            await connection.query(
                `
                INSERT INTO timetable_entry_rooms
                    (timetable_entry_id, room_id)
                VALUES (?, ?)
                `,
                [timetableEntryId, selectedRoomId]
            );
        }

        // Save batches.
        for (const batchId of batches) {
            await connection.query(
                `
                INSERT INTO timetable_entry_batches
                    (timetable_entry_id, batch_id)
                VALUES (?, ?)
                `,
                [timetableEntryId, batchId]
            );
        }

        // Save faculty.
        for (const facultyId of teachers) {
            await connection.query(
                `
                INSERT INTO timetable_entry_faculty
                    (timetable_entry_id, faculty_id)
                VALUES (?, ?)
                `,
                [timetableEntryId, facultyId]
            );
        }

        await connection.commit();

        const io = req.app.get('io');

        if (io) {
            const roomName = getTimetableCellRoom(
                sessionId,
                day,
                slot
            );

            io.to(roomName).emit('resource-lock-updated', {
                academicSessionId: sessionId,
                day,
                slotId: slot,
                timetableEntryId
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Timetable entry created successfully.',
            timetableEntryId
        });

    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error('ROLLBACK ERROR:', rollbackError);
        }

        console.error('CREATE TIMETABLE ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create timetable entry.',
            error: error.message
        });

    } finally {
        connection.release();
    }
};

// ======================================================
// UPDATE TIMETABLE ENTRY
// ======================================================

exports.updateTimetableEntry = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const entryId = Number(req.params.id);

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
            roomIds,
            batchIds,
            teacherIds,
            totalStudents
        } = req.body;

        const sessionId = Number(academicSessionId);
        const program = Number(programId);
        const department = Number(departmentId);
        const semester = Number(semesterId);
        const slot = Number(slotId);
        const subject = Number(subjectId);
        const type = String(lectureType || '').toUpperCase();

        const rooms = [
            ...new Set(
                (Array.isArray(roomIds) && roomIds.length
                    ? roomIds
                    : roomId != null ? [roomId] : []
                )
                .map(Number)
                .filter(id => Number.isInteger(id) && id > 0)
            )
        ];

        const batches = Array.isArray(batchIds)
            ? [...new Set(batchIds.map(Number).filter(id => id > 0))]
            : [];

        const teachers = Array.isArray(teacherIds)
            ? [...new Set(teacherIds.map(Number).filter(id => id > 0))]
            : [];

        const students = Number(totalStudents || 0);

        if (
            !Number.isInteger(entryId) || entryId <= 0 ||
            !sessionId || !program || !department || !semester ||
            !slot || !subject || !day || !['L', 'T', 'P'].includes(type)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Required timetable fields are missing.'
            });
        }

        if (rooms.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one room or lab is required.'
            });
        }

        if (type !== 'P' && rooms.length !== 1) {
            return res.status(400).json({
                success: false,
                message: 'Lecture and tutorial classes must have exactly one room.'
            });
        }

        if (batches.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one batch is required.'
            });
        }

        await connection.beginTransaction();

        const [existingEntry] = await connection.query(
            `
            SELECT id
            FROM timetable_entries
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [entryId]
        );

        if (existingEntry.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found.'
            });
        }

        const [validRooms] = await connection.query(
            `SELECT id FROM rooms WHERE id IN (?)`,
            [rooms]
        );

        if (validRooms.length !== rooms.length) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'One or more selected rooms are invalid.'
            });
        }

        // Check conflicts against both legacy room_id and room mappings.
        const [roomConflict] = await connection.query(
            `
            SELECT DISTINCT te.id
            FROM timetable_entries te
            LEFT JOIN timetable_entry_rooms ter
                ON ter.timetable_entry_id = te.id
            WHERE te.academic_session_id = ?
              AND te.day = ?
              AND te.slot_id = ?
              AND te.id != ?
              AND (
                    te.room_id IN (?)
                    OR ter.room_id IN (?)
              )
            LIMIT 1
            `,
            [sessionId, day, slot, entryId, rooms, rooms]
        );

        if (roomConflict.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: 'One or more selected rooms are already booked for this time slot.'
            });
        }

        // Faculty conflict.
        if (teachers.length > 0) {
            const [facultyConflict] = await connection.query(
                `
                SELECT f.name
                FROM timetable_entry_faculty tef
                INNER JOIN timetable_entries te
                    ON te.id = tef.timetable_entry_id
                INNER JOIN faculty f
                    ON f.id = tef.faculty_id
                WHERE te.academic_session_id = ?
                  AND te.day = ?
                  AND te.slot_id = ?
                  AND tef.faculty_id IN (?)
                  AND te.id != ?
                LIMIT 1
                `,
                [sessionId, day, slot, teachers, entryId]
            );

            if (facultyConflict.length > 0) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: `Faculty ${facultyConflict[0].name} is already teaching during this time slot.`
                });
            }
        }

        // Batch conflict.
        const [batchConflict] = await connection.query(
            `
            SELECT b.batch_code
            FROM timetable_entry_batches teb
            INNER JOIN timetable_entries te
                ON te.id = teb.timetable_entry_id
            INNER JOIN batches b
                ON b.id = teb.batch_id
            WHERE te.academic_session_id = ?
              AND te.day = ?
              AND te.slot_id = ?
              AND teb.batch_id IN (?)
              AND te.id != ?
            LIMIT 1
            `,
            [sessionId, day, slot, batches, entryId]
        );

        if (batchConflict.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: `Batch ${batchConflict[0].batch_code} is already scheduled during this time slot.`
            });
        }

        // Update main entry. First room remains in legacy room_id.
        await connection.query(
            `
            UPDATE timetable_entries
            SET
                academic_session_id = ?,
                program_id = ?,
                department_id = ?,
                semester_id = ?,
                day = ?,
                slot_id = ?,
                start_time = ?,
                end_time = ?,
                subject_id = ?,
                lecture_type = ?,
                room_id = ?,
                total_students = ?
            WHERE id = ?
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
                type,
                rooms[0],
                students,
                entryId
            ]
        );

        // Replace all room mappings.
        await connection.query(
            `DELETE FROM timetable_entry_rooms WHERE timetable_entry_id = ?`,
            [entryId]
        );

        for (const selectedRoomId of rooms) {
            await connection.query(
                `
                INSERT INTO timetable_entry_rooms
                    (timetable_entry_id, room_id)
                VALUES (?, ?)
                `,
                [entryId, selectedRoomId]
            );
        }

        // Replace batches.
        await connection.query(
            `DELETE FROM timetable_entry_batches WHERE timetable_entry_id = ?`,
            [entryId]
        );

        for (const batchId of batches) {
            await connection.query(
                `
                INSERT INTO timetable_entry_batches
                    (timetable_entry_id, batch_id)
                VALUES (?, ?)
                `,
                [entryId, batchId]
            );
        }

        // Replace faculty.
        await connection.query(
            `DELETE FROM timetable_entry_faculty WHERE timetable_entry_id = ?`,
            [entryId]
        );

        for (const facultyId of teachers) {
            await connection.query(
                `
                INSERT INTO timetable_entry_faculty
                    (timetable_entry_id, faculty_id)
                VALUES (?, ?)
                `,
                [entryId, facultyId]
            );
        }

        await connection.commit();

        const io = req.app.get('io');

        if (io) {
            const roomName = getTimetableCellRoom(
                sessionId,
                day,
                slot
            );

            io.to(roomName).emit('resource-lock-updated', {
                academicSessionId: sessionId,
                day,
                slotId: slot,
                timetableEntryId: entryId
            });
        }

        return res.json({
            success: true,
            message: 'Timetable entry updated successfully.',
            timetableEntryId: entryId
        });

    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error('ROLLBACK ERROR:', rollbackError);
        }

        console.error('UPDATE TIMETABLE ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update timetable entry.',
            error: error.message
        });

    } finally {
        connection.release();
    }
};

exports.deleteTimetableEntry = async (req, res) => {
    const connection = await db.getConnection();


    try {
        const entryId = Number(req.params.id);


        if (!Number.isInteger(entryId) || entryId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Timetable entry ID is required.'
            });
        }


        await connection.beginTransaction();


        // 1. Find the selected entry.
        const [existingEntries] = await connection.query(
            `
            SELECT
                id,
                academic_session_id,
                day,
                slot_id,
                subject_id,
                lecture_type
            FROM timetable_entries
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [entryId]
        );


        if (existingEntries.length === 0) {
            await connection.rollback();


            return res.status(404).json({
                success: false,
                message: 'Timetable entry not found.'
            });
        }


        const entry = existingEntries[0];


        // Entries to delete; ordinary classes delete only themselves.
        const entriesToDelete = [entry];


        // 2. For a practical, locate its matching next-slot entry.
        if (entry.lecture_type === 'P') {
            const [selectedBatches] = await connection.query(
                `
                SELECT batch_id
                FROM timetable_entry_batches
                WHERE timetable_entry_id = ?
                ORDER BY batch_id
                `,
                [entryId]
            );


            const selectedBatchIds = selectedBatches.map(
                row => Number(row.batch_id)
            );


            const [candidates] = await connection.query(
                `
                SELECT
                    id,
                    academic_session_id,
                    day,
                    slot_id,
                    subject_id,
                    lecture_type
                FROM timetable_entries
                WHERE academic_session_id = ?
                  AND day = ?
                  AND slot_id = ?
                  AND subject_id = ?
                  AND lecture_type = 'P'
                  AND id != ?
                FOR UPDATE
                `,
                [
                    entry.academic_session_id,
                    entry.day,
                    Number(entry.slot_id) + 1,
                    entry.subject_id,
                    entryId
                ]
            );


            // Only pair entries with exactly the same batch assignment.
            for (const candidate of candidates) {
                const [candidateBatches] = await connection.query(
                    `
                    SELECT batch_id
                    FROM timetable_entry_batches
                    WHERE timetable_entry_id = ?
                    ORDER BY batch_id
                    `,
                    [candidate.id]
                );


                const candidateBatchIds = candidateBatches.map(
                    row => Number(row.batch_id)
                );


                const sameBatches =
                    selectedBatchIds.length === candidateBatchIds.length &&
                    selectedBatchIds.every(
                        (id, index) => id === candidateBatchIds[index]
                    );


                if (sameBatches) {
                    entriesToDelete.push(candidate);
                    break;
                }
            }
        }


        // 3. Delete relationships and entries in the same transaction.
        const deletedIds = entriesToDelete.map(entry => entry.id);


        for (const id of deletedIds) {
            await connection.query(
                `
                DELETE FROM timetable_entry_batches
                WHERE timetable_entry_id = ?
                `,
                [id]
            );


            await connection.query(
                `
                DELETE FROM timetable_entry_faculty
                WHERE timetable_entry_id = ?
                `,
                [id]
            );

            await connection.query(
                `
                DELETE FROM timetable_entry_rooms
                WHERE timetable_entry_id = ?
                `,
                [id]
            );

            await connection.query(
                `
                DELETE FROM timetable_entries
                WHERE id = ?
                `,
                [id]
            );
        }


        await connection.commit();


        // 4. Notify clients for every affected timetable cell.
        const io = req.app.get('io');


        if (io) {
            for (const deletedEntry of entriesToDelete) {
                const roomName = getTimetableCellRoom(
                    deletedEntry.academic_session_id,
                    deletedEntry.day,
                    deletedEntry.slot_id
                );


                const eventPayload = {
                    academicSessionId:
                        deletedEntry.academic_session_id,
                    day: deletedEntry.day,
                    slotId: deletedEntry.slot_id,
                    timetableEntryId: deletedEntry.id
                };


                io.to(roomName).emit(
                    'timetable-entry-deleted',
                    eventPayload
                );


                io.to(roomName).emit(
                    'resource-lock-updated',
                    eventPayload
                );
            }
        }


        return res.json({
            success: true,
            message: entry.lecture_type === 'P' &&
                entriesToDelete.length === 2
                ? 'Practical class and its consecutive slot deleted successfully.'
                : 'Timetable entry deleted successfully.',
            timetableEntryId: entryId,
            deletedEntryIds: deletedIds
        });


    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error('ROLLBACK ERROR:', rollbackError);
        }


        console.error('DELETE TIMETABLE ERROR:', error);


        return res.status(500).json({
            success: false,
            message: 'Failed to delete timetable entry.',
            error: error.message
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

            // Load all rooms/labs assigned to this timetable entry.
            const [rooms] = await db.query(
                `
                SELECT
                    r.id,
                    r.room_id AS room_code,
                    r.room_name,
                    r.room_type,
                    r.capacity
                FROM timetable_entry_rooms ter
                INNER JOIN rooms r
                    ON r.id = ter.room_id
                WHERE ter.timetable_entry_id = ?
                ORDER BY r.id
                `,
                [entry.id]
            );

            entry.rooms = rooms;

            // Backward compatibility for entries created before multi-room support.
            if (rooms.length === 0 && entry.room_id) {
                entry.rooms = [{
                    id: entry.room_id,
                    room_code: entry.room_code,
                    room_name: entry.room_name,
                    room_type: entry.room_type,
                    capacity: entry.room_capacity
                }];
            }
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
            SELECT DISTINCT room_id
            FROM (
                SELECT te.room_id AS room_id
                FROM timetable_entries te
                WHERE te.academic_session_id = ?
                AND te.day = ?
                AND te.slot_id = ?

                UNION

                SELECT ter.room_id AS room_id
                FROM timetable_entry_rooms ter
                INNER JOIN timetable_entries te
                    ON te.id = ter.timetable_entry_id
                WHERE te.academic_session_id = ?
                AND te.day = ?
                AND te.slot_id = ?
            ) AS booked_rooms
        `;

        const roomParams = [
            sessionId, day, slot,
            sessionId, day, slot
        ];

        if (excludeEntryId) {
            roomQuery = `
                SELECT DISTINCT room_id
                FROM (
                    SELECT te.room_id AS room_id
                    FROM timetable_entries te
                    WHERE te.academic_session_id = ?
                    AND te.day = ?
                    AND te.slot_id = ?
                    AND te.id != ?

                    UNION

                    SELECT ter.room_id AS room_id
                    FROM timetable_entry_rooms ter
                    INNER JOIN timetable_entries te
                        ON te.id = ter.timetable_entry_id
                    WHERE te.academic_session_id = ?
                    AND te.day = ?
                    AND te.slot_id = ?
                    AND te.id != ?
                ) AS booked_rooms
            `;

            roomParams.splice(
                0,
                roomParams.length,
                sessionId, day, slot, Number(excludeEntryId),
                sessionId, day, slot, Number(excludeEntryId)
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

// ======================================================
// FINALIZE TIMETABLE
// ======================================================

exports.finalizeTimetable = async (req, res) => {
    try {
        const {
            academicSessionId,
            programId,
            departmentId,
            semesterId,
            userId
        } = req.body;

        const sessionId = Number(academicSessionId);
        const program = Number(programId);
        const department = Number(departmentId);
        const semester = Number(semesterId);

        if (
            !Number.isInteger(sessionId) || sessionId <= 0 ||
            !Number.isInteger(program) || program <= 0 ||
            !Number.isInteger(department) || department <= 0 ||
            !Number.isInteger(semester) || semester <= 0
        ) {
            return res.status(400).json({
                success: false,
                finalized: false,
                message: 'Valid academic session, program, department, and semester are required.'
            });
        }

        // Validate subject hours for all applicable batches.
        const validation = await validateTimetableCompletion({
            academicSessionId: sessionId,
            programId: program,
            departmentId: department,
            semesterId: semester
        });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                finalized: false,
                status: 'DRAFT',
                message: 'Timetable is incomplete. Resolve the listed issues before finalizing.',
                errors: validation.errors
            });
        }

        // Save status separately from lunch configuration.
        await db.query(
            `
            INSERT INTO timetable_status (
                academic_session_id,
                program_id,
                department_id,
                semester_id,
                status,
                finalized_by,
                finalized_at
            )
            VALUES (?, ?, ?, ?, 'FINALIZED', ?, NOW())
            ON DUPLICATE KEY UPDATE
                status = 'FINALIZED',
                finalized_by = VALUES(finalized_by),
                finalized_at = NOW()
            `,
            [
                sessionId,
                program,
                department,
                semester,
                userId ? Number(userId) : null
            ]
        );

        return res.json({
            success: true,
            finalized: true,
            status: 'FINALIZED',
            message: 'Timetable finalized successfully.'
        });

    } catch (error) {
        console.error('FINALIZE TIMETABLE ERROR:', error);

        return res.status(500).json({
            success: false,
            finalized: false,
            message: 'Failed to finalize timetable.'
        });
    }
};


// ======================================================
// UNFINALIZE TIMETABLE
// ======================================================

exports.unfinalizeTimetable = async (req, res) => {
    try {
        const {
            academicSessionId,
            programId,
            departmentId,
            semesterId
        } = req.body;

        const sessionId = Number(academicSessionId);
        const program = Number(programId);
        const department = Number(departmentId);
        const semester = Number(semesterId);

        if (
            !Number.isInteger(sessionId) || sessionId <= 0 ||
            !Number.isInteger(program) || program <= 0 ||
            !Number.isInteger(department) || department <= 0 ||
            !Number.isInteger(semester) || semester <= 0
        ) {
            return res.status(400).json({
                success: false,
                finalized: false,
                message: 'Valid academic session, program, department, and semester are required.'
            });
        }

        await db.query(
            `
            INSERT INTO timetable_status (
                academic_session_id,
                program_id,
                department_id,
                semester_id,
                status,
                finalized_by,
                finalized_at
            )
            VALUES (?, ?, ?, ?, 'DRAFT', NULL, NULL)
            ON DUPLICATE KEY UPDATE
                status = 'DRAFT',
                finalized_by = NULL,
                finalized_at = NULL
            `,
            [
                sessionId,
                program,
                department,
                semester
            ]
        );

        return res.json({
            success: true,
            finalized: false,
            status: 'DRAFT',
            message: 'Timetable moved back to draft.'
        });

    } catch (error) {
        console.error('UNFINALIZE TIMETABLE ERROR:', error);

        return res.status(500).json({
            success: false,
            finalized: false,
            message: 'Failed to unfinalize timetable.'
        });
    }
};


// ======================================================
// GET TIMETABLE STATUS
// ======================================================

exports.getTimetableStatus = async (req, res) => {
    try {
        const {
            academicSessionId,
            programId,
            departmentId,
            semesterId
        } = req.query;

        const sessionId = Number(academicSessionId);
        const program = Number(programId);
        const department = Number(departmentId);
        const semester = Number(semesterId);

        if (
            !Number.isInteger(sessionId) || sessionId <= 0 ||
            !Number.isInteger(program) || program <= 0 ||
            !Number.isInteger(department) || department <= 0 ||
            !Number.isInteger(semester) || semester <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Valid academic session, program, department, and semester are required.'
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                status,
                finalized_at,
                finalized_by
            FROM timetable_status
            WHERE academic_session_id = ?
              AND program_id = ?
              AND department_id = ?
              AND semester_id = ?
            LIMIT 1
            `,
            [
                sessionId,
                program,
                department,
                semester
            ]
        );

        if (rows.length === 0) {
            return res.json({
                success: true,
                status: 'DRAFT',
                finalizedAt: null,
                finalizedBy: null
            });
        }

        return res.json({
            success: true,
            status: rows[0].status,
            finalizedAt: rows[0].finalized_at,
            finalizedBy: rows[0].finalized_by
        });

    } catch (error) {
        console.error('GET TIMETABLE STATUS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to get timetable status.'
        });
    }
};


exports.getSubjectHours = async (req, res) => {
  try {
    const batchId = Number(req.query.batchId);
    const subjectId = Number(req.query.subjectId);
    const academicSessionId = Number(req.query.academicSessionId);

    if (
      !Number.isInteger(batchId) || batchId <= 0 ||
      !Number.isInteger(subjectId) || subjectId <= 0 ||
      !Number.isInteger(academicSessionId) || academicSessionId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid batchId, subjectId and academicSessionId are required.'
      });
    }

    // Get the required L/T/P hours for this subject.
    const [subjects] = await db.query(
      `SELECT lecture_hours, tutorial_hours, practical_hours
       FROM subjects
       WHERE id = ? AND is_active = 1`,
      [subjectId]
    );

    if (subjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active subject not found.'
      });
    }

    const subject = subjects[0];

    // Count already scheduled entries for this batch, subject and session.
    const [rows] = await db.query(
      `SELECT te.lecture_type, COUNT(*) AS scheduled
       FROM timetable_entries te
       INNER JOIN timetable_entry_batches teb
         ON teb.timetable_entry_id = te.id
       WHERE teb.batch_id = ?
         AND te.subject_id = ?
         AND te.academic_session_id = ?
       GROUP BY te.lecture_type`,
      [batchId, subjectId, academicSessionId]
    );

    const scheduled = { L: 0, T: 0, P: 0 };

    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(scheduled, row.lecture_type)) {
        scheduled[row.lecture_type] = Number(row.scheduled);
      }
    }

    return res.json({
      success: true,
      batchId,
      subjectId,
      academicSessionId,
      required: {
        L: Number(subject.lecture_hours || 0),
        T: Number(subject.tutorial_hours || 0),
        P: Number(subject.practical_hours || 0)
      },
      scheduled,
      remaining: {
        L: Math.max(0, Number(subject.lecture_hours || 0) - scheduled.L),
        T: Math.max(0, Number(subject.tutorial_hours || 0) - scheduled.T),
        P: Math.max(0, Number(subject.practical_hours || 0) - scheduled.P)
      }
    });
  } catch (error) {
    console.error('Error loading subject hours:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load subject hours.'
    });
  }
};

exports.checkPracticalAvailability = async (req, res) => {
  try {
    console.log('Practical availability request:', req.body);

    return res.status(200).json({
      available: true,
      message: 'Practical availability route is working.'
    });
  } catch (error) {
    console.error('Practical availability error:', error);

    return res.status(500).json({
      available: false,
      message: 'Failed to check practical availability.'
    });
  }
};