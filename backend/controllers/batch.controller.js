const pool = require('../config/db');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

/* =========================================================
   CSV HEADER VALIDATION
========================================================= */

const REQUIRED_HEADERS = [
    'batch_code',
    'program',
    'batch_type',
    'enrollment_year',
    'department'
];

function normalizeHeader(header) {
    return String(header || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function normalizeProgram(value) {
    return String(value || '')
        .trim()
        .toUpperCase();
}

function normalizeBatchType(value) {
    const type = String(value || '')
        .trim()
        .toLowerCase();

    if (type === 'integrated') {
        return 'Integrated';
    }

    return 'Regular';
}

/* =========================================================
   PARSE CSV BUFFER
========================================================= */

function parseCSVBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const rows = [];

        const stream = Readable.from([buffer]);

        stream
            .pipe(
                csvParser({
                    mapHeaders: ({ header }) => normalizeHeader(header)
                })
            )
            .on('data', row => {
                rows.push(row);
            })
            .on('end', () => {
                resolve(rows);
            })
            .on('error', error => {
                reject(error);
            });
    });
}

/* =========================================================
   VALIDATE ROW
========================================================= */

function validateBatchRow(row, rowNumber) {
    const errors = [];

    const batchCode = String(row.batch_code || '').trim();
    const program = normalizeProgram(row.program);
    const batchType = normalizeBatchType(row.batch_type);
    const enrollmentYear = String(row.enrollment_year || '').trim();
    const department = String(row.department || '').trim();

    if (!batchCode) {
        errors.push('batch_code is required');
    }

    if (!program) {
        errors.push('program is required');
    }

    if (!['BTECH', 'MTECH'].includes(program)) {
        errors.push('program must be BTECH or MTECH');
    }

    if (!String(row.batch_type || '').trim()) {
        errors.push('batch_type is required');
    }

    if (!['Regular', 'Integrated'].includes(batchType)) {
        errors.push('batch_type must be Regular or Integrated');
    }

    if (!enrollmentYear) {
        errors.push('enrollment_year is required');
    } else {
        const year = Number(enrollmentYear);

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            errors.push('enrollment_year must be a valid year');
        }
    }

    if (!department) {
        errors.push('department is required');
    }

    return {
        valid: errors.length === 0,
        errors,
        data: {
            batch_code: batchCode,
            program,
            batch_type: batchType,
            enrollment_year: Number(enrollmentYear),
            department
        },
        rowNumber
    };
}

/* =========================================================
   GET ALL BATCHES
========================================================= */

const getBatches = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                batch_code,
                program,
                batch_type,
                enrollment_year,
                department,
                is_active,
                created_at,
                updated_at
            FROM batches
            WHERE is_active = 1
            ORDER BY enrollment_year DESC, batch_code ASC
        `);

        res.json({
            success: true,
            count: rows.length,
            batches: rows
        });

    } catch (error) {
        console.error('Get batches error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch batches'
        });
    }
};

/* =========================================================
   GET SINGLE BATCH
========================================================= */

const getBatchById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `
            SELECT
                id,
                batch_code,
                program,
                batch_type,
                enrollment_year,
                department,
                is_active,
                created_at,
                updated_at
            FROM batches
            WHERE id = ?
              AND is_active = 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.json({
            success: true,
            batch: rows[0]
        });

    } catch (error) {
        console.error('Get batch error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch'
        });
    }
};

/* =========================================================
   ADD BATCH
========================================================= */

const createBatch = async (req, res) => {
    try {
        const {
            batch_code,
            program,
            batch_type,
            enrollment_year,
            department
        } = req.body;

        if (
            !batch_code ||
            !program ||
            !batch_type ||
            !enrollment_year ||
            !department
        ) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const [duplicate] = await pool.query(
            `
            SELECT id
            FROM batches
            WHERE batch_code = ?
              AND program = ?
              AND enrollment_year = ?
              AND department = ?
            `,
            [
                batch_code.trim(),
                program.trim().toUpperCase(),
                enrollment_year,
                department.trim()
            ]
        );

        if (duplicate.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    'This batch already exists for the same program, enrollment year and department'
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO batches
            (
                batch_code,
                program,
                batch_type,
                enrollment_year,
                department,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, 1)
            `,
            [
                batch_code.trim(),
                program.trim().toUpperCase(),
                batch_type.trim(),
                enrollment_year,
                department.trim()
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Batch added successfully',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create batch error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to add batch'
        });
    }
};

/* =========================================================
   UPDATE BATCH
========================================================= */

const updateBatch = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            batch_code,
            program,
            batch_type,
            enrollment_year,
            department
        } = req.body;

        if (
            !batch_code ||
            !program ||
            !batch_type ||
            !enrollment_year ||
            !department
        ) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const [duplicate] = await pool.query(
            `
            SELECT id
            FROM batches
            WHERE batch_code = ?
              AND program = ?
              AND enrollment_year = ?
              AND department = ?
              AND id != ?
            `,
            [
                batch_code.trim(),
                program.trim().toUpperCase(),
                enrollment_year,
                department.trim(),
                id
            ]
        );

        if (duplicate.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    'Another batch already exists with the same batch code, program, enrollment year and department'
            });
        }

        const [result] = await pool.query(
            `
            UPDATE batches
            SET
                batch_code = ?,
                program = ?,
                batch_type = ?,
                enrollment_year = ?,
                department = ?
            WHERE id = ?
            `,
            [
                batch_code.trim(),
                program.trim().toUpperCase(),
                batch_type.trim(),
                enrollment_year,
                department.trim(),
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.json({
            success: true,
            message: 'Batch updated successfully'
        });
    } catch (error) {
        console.error('Update batch error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to update batch'
        });
    }
};

/* =========================================================
   DELETE BATCH
   Soft delete
========================================================= */

const deleteBatch = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `
            DELETE FROM batches
            WHERE id = ?
            `,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.json({
            success: true,
            message: 'Batch deleted successfully'
        });
    } catch (error) {
        console.error('Delete batch error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to delete batch'
        });
    }
};

/* =========================================================
   PREVIEW CSV
========================================================= */

const previewBatches = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a CSV file'
            });
        }

        const rows = await parseCSVBuffer(req.file.buffer);

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'CSV file is empty'
            });
        }

        const headers = Object.keys(rows[0]);

        const missingHeaders = REQUIRED_HEADERS.filter(
            header => !headers.includes(header)
        );

        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required columns: ${missingHeaders.join(', ')}`,
                requiredColumns: REQUIRED_HEADERS,
                receivedColumns: headers
            });
        }

        const preview = [];
        const errors = [];

        rows.forEach((row, index) => {
            const rowNumber = index + 2;

            const validation = validateBatchRow(row, rowNumber);

            if (!validation.valid) {
                errors.push({
                    row: rowNumber,
                    errors: validation.errors,
                    data: validation.data
                });
            }

            preview.push({
                row: rowNumber,
                ...validation.data,
                valid: validation.valid,
                errors: validation.errors
            });
        });

        res.json({
            success: true,
            total: rows.length,
            valid: preview.filter(row => row.valid).length,
            invalid: preview.filter(row => !row.valid).length,
            errors,
            data: preview
        });

    } catch (error) {
        console.error('Preview batches error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to preview CSV'
        });
    }
};

/* =========================================================
   IMPORT CSV
========================================================= */

const importBatches = async (req, res) => {
    let connection;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a CSV file'
            });
        }

        const rows = await parseCSVBuffer(req.file.buffer);

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'CSV file is empty'
            });
        }

        const headers = Object.keys(rows[0]);

        const missingHeaders = REQUIRED_HEADERS.filter(
            header => !headers.includes(header)
        );

        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required columns: ${missingHeaders.join(', ')}`
            });
        }

        const validatedRows = rows.map((row, index) =>
            validateBatchRow(row, index + 2)
        );

        const invalidRows = validatedRows.filter(row => !row.valid);

        if (invalidRows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'CSV contains invalid rows. Please fix the errors before importing.',
                invalid: invalidRows.length,
                errors: invalidRows
            });
        }

        /*
         * Detect duplicate batch codes inside the CSV itself
         */
        const batchIdentities = new Set();
        const duplicateRows = [];

        for (const row of validatedRows) {
            const data = row.data;

            const identity = [
                data.batch_code.toUpperCase(),
                data.program.toUpperCase(),
                data.enrollment_year,
                data.department.trim().toLowerCase()
            ].join('|');

            if (batchIdentities.has(identity)) {
                duplicateRows.push(row.rowNumber);
            }

            batchIdentities.add(identity);
        }

        if (duplicateRows.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    `Duplicate batch combination found in CSV at rows: ${duplicateRows.join(', ')}. ` +
                    `The same batch code cannot be repeated for the same program, enrollment year and department.`
            });
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        let inserted = 0;
        let updated = 0;
        let unchanged = 0;

        for (const row of validatedRows) {
            const data = row.data;

            const [existingRows] = await connection.query(
                `
                SELECT
                    id,
                    batch_code,
                    program,
                    batch_type,
                    enrollment_year,
                    department,
                    is_active
                FROM batches
                WHERE batch_code = ?
                AND program = ?
                AND enrollment_year = ?
                AND department = ?
                LIMIT 1
                `,
                [
                    data.batch_code,
                    data.program,
                    data.enrollment_year,
                    data.department
                ]
            );

            if (existingRows.length === 0) {

                await connection.query(
                    `
                    INSERT INTO batches
                    (
                        batch_code,
                        program,
                        batch_type,
                        enrollment_year,
                        department,
                        is_active
                    )
                    VALUES (?, ?, ?, ?, ?, 1)
                    `,
                    [
                        data.batch_code,
                        data.program,
                        data.batch_type,
                        data.enrollment_year,
                        data.department
                    ]
                );

                inserted++;

            } else {

                const existing = existingRows[0];

                const same =
                    existing.program === data.program &&
                    existing.batch_type === data.batch_type &&
                    Number(existing.enrollment_year) ===
                        Number(data.enrollment_year) &&
                    existing.department === data.department &&
                    Number(existing.is_active) === 1;

                if (same) {

                    unchanged++;

                } else {

                    await connection.query(
                        `
                        UPDATE batches
                        SET
                            program = ?,
                            batch_type = ?,
                            enrollment_year = ?,
                            department = ?,
                            is_active = 1
                        WHERE id = ?
                        `,
                        [
                            data.program,
                            data.batch_type,
                            data.enrollment_year,
                            data.department,
                            existing.id
                        ]
                    );

                    updated++;
                }
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Batch import completed successfully',
            total: validatedRows.length,
            inserted,
            updated,
            unchanged
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error('Import batches error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to import batches'
        });

    } finally {

        if (connection) {
            connection.release();
        }
    }
};

/* =========================================================
   ELIGIBLE BATCHES FOR TIMETABLE
========================================================= */

const getEligibleBatches = async (req, res) => {
    try {
        const {
            program,
            semester,
            academicSessionStartYear
        } = req.query;

        if (!program || !semester || !academicSessionStartYear) {
            return res.status(400).json({
                success: false,
                message:
                    'program, semester and academicSessionStartYear are required'
            });
        }

        const normalizedProgram = normalizeProgram(program);
        const semesterNumber = Number(semester);
        const sessionStartYear = Number(academicSessionStartYear);

        if (!['BTECH', 'MTECH'].includes(normalizedProgram)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid program'
            });
        }

        if (!Number.isInteger(semesterNumber) || semesterNumber < 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid semester'
            });
        }

        if (
            !Number.isInteger(sessionStartYear) ||
            sessionStartYear < 2000
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid academic session start year'
            });
        }

        /*
         * M.Tech Semester 1
         *
         * 1. M.Tech first-year students
         *    enrollment_year = session start
         *
         * 2. Integrated M.Tech represented as BTECH:
         *    4th year = session - 3
         *    5th year = session - 4
         */
        if (
            normalizedProgram === 'MTECH' &&
            semesterNumber === 1
        ) {
            const mtechFirstYear = sessionStartYear;
            const integratedFourthYear = sessionStartYear - 3;
            const integratedFifthYear = sessionStartYear - 4;

            const [rows] = await pool.query(
                `
                SELECT
                    id,
                    batch_code,
                    program,
                    batch_type,
                    enrollment_year,
                    department,
                    is_active
                FROM batches
                WHERE is_active = 1
                  AND (
                        (
                            program = 'MTECH'
                            AND enrollment_year = ?
                        )
                        OR
                        (
                            program = 'BTECH'
                            AND batch_type = 'Integrated'
                            AND enrollment_year IN (?, ?)
                        )
                  )
                ORDER BY
                    CASE
                        WHEN program = 'MTECH' THEN 1
                        ELSE 2
                    END,
                    enrollment_year ASC,
                    batch_code ASC
                `,
                [
                    mtechFirstYear,
                    integratedFourthYear,
                    integratedFifthYear
                ]
            );

            return res.json({
                success: true,
                count: rows.length,
                batches: rows
            });
        }

        /*
         * B.Tech Semester 1
         *
         * All B.Tech batches enrolled in the current
         * academic session.
         *
         * This intentionally does NOT filter batch_type,
         * so both Regular and Integrated are returned.
         */
        if (
            normalizedProgram === 'BTECH' &&
            semesterNumber === 1
        ) {
            const [rows] = await pool.query(
                `
                SELECT
                    id,
                    batch_code,
                    program,
                    batch_type,
                    enrollment_year,
                    department,
                    is_active
                FROM batches
                WHERE is_active = 1
                  AND program = 'BTECH'
                  AND enrollment_year = ?
                ORDER BY
                    batch_type ASC,
                    batch_code ASC
                `,
                [sessionStartYear]
            );

            return res.json({
                success: true,
                count: rows.length,
                batches: rows
            });
        }

        /*
         * We don't invent eligibility rules for semesters
         * that have not yet been defined.
         */
        return res.status(400).json({
            success: false,
            message:
                `Eligibility rule is not configured for ${normalizedProgram} semester ${semesterNumber}`
        });

    } catch (error) {
        console.error('Eligible batches error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to load eligible batches'
        });
    }
};


module.exports = {
    getBatches,
    getBatchById,
    createBatch,
    updateBatch,
    deleteBatch,
    previewBatches,
    importBatches,
    getEligibleBatches
};