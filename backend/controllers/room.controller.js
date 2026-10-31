const fs = require("fs");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const db = require("../config/db");


// ==================================================
// PREVIEW ROOM CSV / EXCEL
// ==================================================

exports.previewRooms = (req, res) => {

    if (!req.file) {

        return res.status(400).json({

            message:
                "Please upload a CSV or Excel file"

        });

    }


    const filePath =
        req.file.path;


    const extension =
        req.file.originalname
            .split(".")
            .pop()
            .toLowerCase();


    // ==================================================
    // REQUIRED COLUMNS
    // ==================================================

    const requiredColumns = [

        "room_id",

        "room_name",

        "room_type",

        "department",

        "capacity"

    ];


    // ==================================================
    // PROCESS ROWS
    // ==================================================

    const processRows = (rawRows) => {

        const rows = [];

        const errors = [];


        // ----------------------------------------------
        // EMPTY FILE
        // ----------------------------------------------

        const firstRow =
            rawRows[0];


        if (!firstRow) {

            return res.status(400).json({

                message:
                    "File is empty"

            });

        }


        // ----------------------------------------------
        // NORMALIZE HEADERS
        // ----------------------------------------------

        const headers =
            Object.keys(firstRow);


        const headerMap = {};


        headers.forEach(header => {

            headerMap[
                header.trim().toLowerCase()
            ] = header;

        });


        // ----------------------------------------------
        // CHECK REQUIRED COLUMNS
        // ----------------------------------------------

        const missingColumns =
            requiredColumns.filter(

                column =>
                    !headerMap[column]

            );


        if (
            missingColumns.length > 0
        ) {

            return res.status(400).json({

                message:
                    `Missing columns: ${missingColumns.join(", ")}`

            });

        }


        // ----------------------------------------------
        // READ ROWS
        // ----------------------------------------------

        rawRows.forEach(
            (rawRow, index) => {

                const rowNumber =
                    index + 2;


                const roomId =
                    String(

                        rawRow[
                            headerMap["room_id"]
                        ] ?? ""

                    ).trim();


                const roomName =
                    String(

                        rawRow[
                            headerMap["room_name"]
                        ] ?? ""

                    ).trim();


                const roomType =
                    String(

                        rawRow[
                            headerMap["room_type"]
                        ] ?? ""

                    )
                    .trim()
                    .toUpperCase();

                const department =
                    String(

                        rawRow[
                            headerMap["department"]
                        ] ?? ""

                    )
                    .trim()
                    .toUpperCase();


                const capacityValue =
                    String(

                        rawRow[
                            headerMap["capacity"]
                        ] ?? ""

                    ).trim();


                const capacity =
                    Number(
                        capacityValue
                    );


                // ==========================================
                // VALIDATE ROOM ID
                // ==========================================

                if (!roomId) {

                    errors.push({

                        row: rowNumber,

                        field: "room_id",

                        message:
                            "Room ID is required"

                    });

                }


                // ==========================================
                // VALIDATE ROOM NAME
                // ==========================================

                if (!roomName) {

                    errors.push({

                        row: rowNumber,

                        field: "room_name",

                        message:
                            "Room name is required"

                    });

                }


                // ==========================================
                // VALIDATE ROOM TYPE
                // ==========================================

                const validRoomTypes = [ "L", "T", "P" ];


                if (!roomType) {

                    errors.push({

                        row: rowNumber,

                        field: "room_type",

                        message:
                            "Room type is required"

                    });

                }
                else if (
                   !["L", "T", "P"].includes(roomType)
                ) {

                    errors.push({

                        row: rowNumber,

                        field: "room_type",

                        message:
                            `Invalid room type "${roomType}". Allowed values: L, T, P`

                    });

                }


                // ==========================================
                // VALIDATE DEPARTMENT
                // ==========================================


                if (!department) {

                    errors.push({

                        row: rowNumber,

                        field: "department",

                        message:
                            "Department is required"

                    });

                }   


                


                // ==========================================
                // VALIDATE CAPACITY
                // ==========================================

                if (
                    !capacityValue
                ) {

                    errors.push({

                        row: rowNumber,

                        field: "capacity",

                        message:
                            "Capacity is required"

                    });

                }
                else if (
                    !Number.isInteger(capacity)
                ) {

                    errors.push({

                        row: rowNumber,

                        field: "capacity",

                        message:
                            "Capacity must be a whole number"

                    });

                }
                else if (
                    capacity <= 0
                ) {

                    errors.push({

                        row: rowNumber,

                        field: "capacity",

                        message:
                            "Capacity must be greater than 0"

                    });

                }


                // ==========================================
                // ADD ROW
                // ==========================================

                rows.push({

                    room_id:
                        roomId,

                    room_name:
                        roomName,

                    room_type:
                        roomType,

                    department,

                    capacity,

                    rowNumber

                });

            }
        );


        // ==================================================
        // CHECK DUPLICATE ROOM IDs IN FILE
        // ==================================================

        const roomIdMap =
            new Map();


        rows.forEach(row => {

            if (!row.room_id) {

                return;

            }


            if (
                roomIdMap.has(
                    row.room_id
                )
            ) {

                errors.push({

                    row:
                        row.rowNumber,

                    field:
                        "room_id",

                    message:
                        `Duplicate room ID "${row.room_id}" in file`

                });

            }
            else {

                roomIdMap.set(

                    row.room_id,

                    row.rowNumber

                );

            }

        });


        // ==================================================
        // DELETE TEMP FILE
        // ==================================================

        fs.unlink(

            filePath,

            (err) => {

                if (err) {

                    console.error(

                        "Failed to delete uploaded file:",

                        err.message

                    );

                }

            }

        );


        // ==================================================
        // VALID ROWS
        // ==================================================

        const validRows =
            rows.filter(row => {

                return !errors.some(

                    error =>
                        error.row ===
                        row.rowNumber

                );

            });


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.json({

            success:
                errors.length === 0,

            totalRows:
                rows.length,

            validRows:
                validRows.length,

            errorCount:
                errors.length,

            errors,

            data:
                rows

        });

    };


    // ==================================================
    // EXCEL
    // ==================================================

    if (

        extension === "xlsx" ||

        extension === "xls"

    ) {

        try {

            const workbook =
                XLSX.readFile(
                    filePath
                );


            const sheetName =
                workbook.SheetNames[0];


            const worksheet =
                workbook.Sheets[
                    sheetName
                ];


            const rawRows =
                XLSX.utils.sheet_to_json(

                    worksheet,

                    {
                        defval: ""
                    }

                );


            return processRows(
                rawRows
            );

        }
        catch (error) {

            console.error(
                "Excel read error:",
                error
            );


            return res.status(500).json({

                message:
                    "Failed to read Excel file",

                error:
                    error.message

            });

        }

    }


    // ==================================================
    // CSV
    // ==================================================

    if (
        extension === "csv"
    ) {

        const rawRows = [];


        fs.createReadStream(
            filePath
        )

        .pipe(
            csv()
        )

        .on(
            "data",
            row => {

                rawRows.push(row);

            }
        )

        .on(
            "end",
            () => {

                return processRows(
                    rawRows
                );

            }
        )

        .on(
            "error",
            error => {

                console.error(
                    "CSV read error:",
                    error
                );


                return res.status(500).json({

                    message:
                        "Failed to read CSV file",

                    error:
                        error.message

                });

            }
        );

        return;

    }


    // ==================================================
    // INVALID FILE TYPE
    // ==================================================

    return res.status(400).json({

        message:
            "Only CSV, XLS, and XLSX files are supported"

    });

};



// ==================================================
// IMPORT ROOMS
// INSERT / UPDATE / UNCHANGED
// ==================================================

exports.importRooms = async (req, res) => {

    try {

        const { data } = req.body;

        // ==================================================
        // BASIC VALIDATION
        // ==================================================

        if (!Array.isArray(data) || data.length === 0) {

            return res.status(400).json({
                success: false,
                message: "No room data received"
            });

        }


        // ==================================================
        // VALIDATE EVERY ROW
        // ==================================================

        for (let i = 0; i < data.length; i++) {

            const row = data[i];

            if (!row.room_id) {

                return res.status(400).json({
                    success: false,
                    message: `Room ID missing at row ${i + 1}`
                });

            }


            if (!row.room_name) {

                return res.status(400).json({
                    success: false,
                    message: `Room name missing at row ${i + 1}`
                });

            }


            if (!row.room_type) {

                return res.status(400).json({
                    success: false,
                    message: `Room type missing at row ${i + 1}`
                });

            }


            if (
                !["L", "T", "P"].includes(
                    String(row.room_type)
                        .trim()
                        .toUpperCase()
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message: `Invalid room type at row ${i + 1}`
                });

            }


            if (!row.department) {

                return res.status(400).json({
                    success: false,
                    message: `Department missing at row ${i + 1}`
                });

            }


            const capacity = Number(row.capacity);

            if (
                !Number.isInteger(capacity) ||
                capacity <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: `Invalid capacity at row ${i + 1}`
                });

            }

        }


        // ==================================================
        // NORMALIZE DATA
        // ==================================================

        const normalizedData = data.map(row => ({

            room_id:
                String(row.room_id).trim(),

            room_name:
                String(row.room_name).trim(),

            room_type:
                String(row.room_type)
                    .trim()
                    .toUpperCase(),

            department:
                String(row.department)
                    .trim()
                    .toUpperCase(),

            capacity:
                Number(row.capacity)

        }));


        console.log("NORMALIZED ROOM DATA:");
        console.log(normalizedData);


        // ==================================================
        // GET ROOM IDS
        // ==================================================

        const roomIds = normalizedData.map(
            row => row.room_id
        );


        const placeholders = roomIds
            .map(() => "?")
            .join(",");


        // ==================================================
        // FIND EXISTING ROOMS
        // ==================================================

        const selectSql = `

            SELECT
                room_id,
                room_name,
                room_type,
                department,
                capacity

            FROM rooms

            WHERE room_id IN (${placeholders})

        `;


        console.log("ABOUT TO RUN DATABASE QUERY");


        const [existingRows] =
            await db.query(
                selectSql,
                roomIds
            );


        console.log(
            "DATABASE QUERY COMPLETED"
        );

        console.log(
            "Existing rooms:",
            existingRows
        );


        // ==================================================
        // EXISTING ROOM MAP
        // ==================================================

        const existingMap = new Map();


        existingRows.forEach(row => {

            existingMap.set(
                String(row.room_id),
                row
            );

        });


        // ==================================================
        // COUNTERS
        // ==================================================

        let inserted = 0;
        let updated = 0;
        let unchanged = 0;


        // ==================================================
        // CHECK EACH ROW
        // ==================================================

        normalizedData.forEach(row => {

            const existing =
                existingMap.get(row.room_id);


            // NEW ROOM
            if (!existing) {

                inserted++;

                return;

            }


            // CHECK CHANGES
            const isSame =

                String(existing.room_name)
                    .trim()
                ===
                row.room_name

                &&

                String(existing.room_type)
                    .trim()
                    .toUpperCase()
                ===
                row.room_type

                &&

                String(existing.department)
                    .trim()
                    .toUpperCase()
                ===
                row.department

                &&

                Number(existing.capacity)
                ===
                row.capacity;


            if (isSame) {

                unchanged++;

            }
            else {

                updated++;

            }

        });


        // ==================================================
        // BULK UPSERT VALUES
        // ==================================================

        const values = normalizedData.map(row => [

            row.room_id,
            row.room_name,
            row.room_type,
            row.department,
            row.capacity

        ]);


        // ==================================================
        // BULK UPSERT
        // ==================================================

        const upsertSql = `

            INSERT INTO rooms
            (
                room_id,
                room_name,
                room_type,
                department,
                capacity
            )

            VALUES ?

            ON DUPLICATE KEY UPDATE

                room_name =
                    VALUES(room_name),

                room_type =
                    VALUES(room_type),

                department =
                    VALUES(department),

                capacity =
                    VALUES(capacity)

        `;


        console.log(
            "ABOUT TO INSERT / UPDATE ROOMS"
        );


        const [result] =
            await db.query(
                upsertSql,
                [values]
            );


        console.log(
            "ROOM IMPORT QUERY COMPLETED"
        );


        // ==================================================
        // RESPONSE
        // ==================================================

        return res.json({

            success: true,

            message:
                "Room import completed successfully",

            total:
                normalizedData.length,

            inserted,

            updated,

            unchanged

        });


    }
    catch (error) {

        console.error(
            "Room import error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Room import failed",

            error:
                error.message

        });

    }

};



// ==================================================
// GET ROOMS
// ==================================================

exports.getRooms = async (req, res) => {

    try {

        const [results] = await db.query(`
            SELECT
                id,
                room_id,
                room_name,
                room_type,
                department,
                capacity,
                created_at,
                updated_at
            FROM rooms
            ORDER BY room_name ASC
        `);

        return res.json(results);

    } catch (error) {

        console.error("Get rooms error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch rooms",
            error: error.message
        });

    }

};

// ==================================================
// ADD ROOM
// ==================================================

exports.addRoom = async (req, res) => {
    try {
        const {
            room_id,
            room_name,
            room_type,
            department,
            capacity
        } = req.body;

        const normalizedRoomId = String(room_id || '').trim();
        const normalizedRoomName = String(room_name || '').trim();
        const normalizedRoomType = String(room_type || '').trim().toUpperCase();
        const normalizedDepartment = String(department || '').trim().toUpperCase();
        const normalizedCapacity = Number(capacity);

        if (!normalizedRoomId || !normalizedRoomName ||
            !normalizedRoomType || !normalizedDepartment ||
            capacity === '' || capacity === null || capacity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'All room fields are required'
            });
        }

        if (!['L', 'T', 'P'].includes(normalizedRoomType)) {
            return res.status(400).json({
                success: false,
                message: 'Room type must be L, T, or P'
            });
        }

        if (!Number.isInteger(normalizedCapacity) || normalizedCapacity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Capacity must be a positive whole number'
            });
        }

        const [existing] = await db.query(
            'SELECT id FROM rooms WHERE room_id = ? LIMIT 1',
            [normalizedRoomId]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: `Room ID "${normalizedRoomId}" already exists`
            });
        }

        const [result] = await db.query(
            `INSERT INTO rooms
                (room_id, room_name, room_type, department, capacity)
             VALUES (?, ?, ?, ?, ?)`,
            [
                normalizedRoomId,
                normalizedRoomName,
                normalizedRoomType,
                normalizedDepartment,
                normalizedCapacity
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Room added successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Add room error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add room'
        });
    }
};


// ==================================================
// UPDATE ROOM
// ==================================================

exports.updateRoom = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const {
            room_id,
            room_name,
            room_type,
            department,
            capacity
        } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room ID'
            });
        }

        const normalizedRoomId = String(room_id || '').trim();
        const normalizedRoomName = String(room_name || '').trim();
        const normalizedRoomType = String(room_type || '').trim().toUpperCase();
        const normalizedDepartment = String(department || '').trim().toUpperCase();
        const normalizedCapacity = Number(capacity);

        if (!normalizedRoomId || !normalizedRoomName ||
            !normalizedRoomType || !normalizedDepartment ||
            capacity === '' || capacity === null || capacity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'All room fields are required'
            });
        }

        if (!['L', 'T', 'P'].includes(normalizedRoomType)) {
            return res.status(400).json({
                success: false,
                message: 'Room type must be L, T, or P'
            });
        }

        if (!Number.isInteger(normalizedCapacity) || normalizedCapacity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Capacity must be a positive whole number'
            });
        }

        const [room] = await db.query(
            'SELECT id FROM rooms WHERE id = ? LIMIT 1',
            [id]
        );

        if (!room.length) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const [duplicate] = await db.query(
            'SELECT id FROM rooms WHERE room_id = ? AND id != ? LIMIT 1',
            [normalizedRoomId, id]
        );

        if (duplicate.length) {
            return res.status(409).json({
                success: false,
                message: `Room ID "${normalizedRoomId}" already exists`
            });
        }

        await db.query(
            `UPDATE rooms
             SET room_id = ?,
                 room_name = ?,
                 room_type = ?,
                 department = ?,
                 capacity = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                normalizedRoomId,
                normalizedRoomName,
                normalizedRoomType,
                normalizedDepartment,
                normalizedCapacity,
                id
            ]
        );

        return res.json({
            success: true,
            message: 'Room updated successfully'
        });
    } catch (error) {
        console.error('Update room error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update room'
        });
    }
};


// ==================================================
// DELETE ROOM
// ==================================================

exports.deleteRoom = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room ID'
            });
        }

        const [room] = await db.query(
            'SELECT id FROM rooms WHERE id = ? LIMIT 1',
            [id]
        );

        if (!room.length) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        await db.query(
            'DELETE FROM rooms WHERE id = ?',
            [id]
        );

        return res.json({
            success: true,
            message: 'Room deleted successfully'
        });
    } catch (error) {
        console.error('Delete room error:', error);

        // A foreign-key constraint may prevent deleting a room
        // that is referenced by timetable data.
        if (error.code === 'ER_ROW_IS_REFERENCED_2' ||
            error.code === 'ER_ROW_IS_REFERENCED') {
            return res.status(409).json({
                success: false,
                message: 'This room is referenced by timetable data and cannot be deleted.'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to delete room'
        });
    }
};