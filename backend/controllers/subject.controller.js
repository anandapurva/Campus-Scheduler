const db = require('../config/db');
const csv = require('csv-parser');
const fs = require('fs');

/*
==================================================
PREVIEW SUBJECT CSV
==================================================
*/

exports.previewSubjects = (req, res) => {

  if (!req.file) {

    return res.status(400).json({
      message: 'CSV file is required'
    });

  }


  const subjects = [];
  const errors = [];

  let rowNumber = 1;


  fs.createReadStream(req.file.path)

    .pipe(
      csv({
        mapHeaders: ({ header }) =>
          header
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase()
      })
    )

    .on('data', (row) => {

      rowNumber++;


      // ==========================================
      // NORMALIZE VALUES
      // ==========================================

      const subjectCode =
        String(
          row.course_code ||
          row.code ||
          ''
        ).trim();


      const subjectName =
        String(
          row.subject_name ||
          row.name ||
          ''
        ).trim();


      const courseType =
        String(
          row.course_type || ''
        ).trim();


      const electiveGroup =
        String(
          row.elective_group || ''
        ).trim();


      const L =
        Number(
          row.L ||
          row.l ||
          0
        );


      const T =
        Number(
          row.T ||
          row.t ||
          0
        );


      const P =
        Number(
          row.P ||
          row.p ||
          0
        );


      const credits =
        String(
          row.credits || ''
        ).trim();


      // ==========================================
      // VALIDATION
      // ==========================================

      if (!subjectCode) {

        errors.push({

          row: rowNumber,

          message:
            'Subject code is required'

        });

        return;

      }


      if (!subjectName) {

        errors.push({

          row: rowNumber,

          message:
            'Subject name is required'

        });

        return;

      }


      // ==========================================
      // ADD VALID ROW
      // ==========================================

      subjects.push({

        course_code:
          subjectCode,

        subject_name:
          subjectName,

        course_type:
          courseType,

        elective_group:
          electiveGroup,

        L: L,

        T: T,

        P: P,

        credits:
          credits

      });

    })


    .on('end', () => {

      fs.unlink(
        req.file.path,
        () => {}
      );


      res.json({

        data:
          subjects,

        errors:
          errors,

        totalRows:
          subjects.length +
          errors.length,

        validRows:
          subjects.length,

        errorCount:
          errors.length

      });

    })


    .on('error', (error) => {

      console.error(
        'CSV PREVIEW ERROR:',
        error
      );


      fs.unlink(
        req.file.path,
        () => {}
      );


      res.status(500).json({

        message:
          'Failed to read CSV file'

      });

    });

};


/*
==================================================
IMPORT SUBJECTS
==================================================
*/

exports.importSubjects = async (req, res) => {

  const {
    data,
    program,
    department,
    semester
  } = req.body;

  try {

    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (!program || !department || !semester) {
      return res.status(400).json({
        message: "Program, department and semester are required"
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        message: "No subject data received"
      });
    }


    // ==================================================
    // GET PROGRAM ID (SUPPORT ID OR NAME)
    // ==================================================

    const programValue = String(program).trim();

    let programRows;

    if (/^\d+$/.test(programValue)) {

      [programRows] = await db.query(
        `
        SELECT id
        FROM programs
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
        `,
        [Number(programValue)]
      );

    } else {

      [programRows] = await db.query(
        `
        SELECT id
        FROM programs
        WHERE program_name = ?
          AND is_active = 1
        LIMIT 1
        `,
        [programValue]
      );

    }

    if (programRows.length === 0) {
      return res.status(400).json({
        message: `Invalid program: ${programValue}`
      });
    }

    const programId = programRows[0].id;


    // ==================================================
    // GET DEPARTMENT ID (SUPPORT ID OR NAME)
    // ==================================================

    const departmentValue = String(department).trim();

    let departmentRows;

    if (/^\d+$/.test(departmentValue)) {

      [departmentRows] = await db.query(
        `
        SELECT d.id
        FROM departments d
        INNER JOIN program_departments pd
          ON pd.department_id = d.id
        WHERE d.id = ?
          AND pd.program_id = ?
          AND d.is_active = 1
          AND pd.is_active = 1
        LIMIT 1
        `,
        [Number(departmentValue), programId]
      );

    } else {

      [departmentRows] = await db.query(
        `
        SELECT d.id
        FROM departments d
        INNER JOIN program_departments pd
          ON pd.department_id = d.id
        WHERE (
          d.name = ?
          OR d.abbreviation = ?
        )
          AND pd.program_id = ?
          AND d.is_active = 1
          AND pd.is_active = 1
        LIMIT 1
        `,
        [departmentValue, departmentValue, programId]
      );

    }

    if (departmentRows.length === 0) {
      return res.status(400).json({
        message: "Invalid department for selected program"
      });
    }

    const departmentId = departmentRows[0].id;


    // ==================================================
    // GET SEMESTER ID (SUPPORT ID OR SEMESTER NUMBER)
    // ==================================================

    const semesterValue = Number(semester);

    if (
      !Number.isInteger(semesterValue) ||
      semesterValue <= 0
    ) {
      return res.status(400).json({
        message: "Invalid semester"
      });
    }

    let semesterRows;

    // First, check using semester database ID.
    [semesterRows] = await db.query(
      `
      SELECT id, semester_number, semester_name
      FROM semesters
      WHERE id = ?
        AND program_id = ?
      LIMIT 1
      `,
      [semesterValue, programId]
    );

    // Backward compatibility: check semester number.
    if (semesterRows.length === 0) {

      [semesterRows] = await db.query(
        `
        SELECT id, semester_number, semester_name
        FROM semesters
        WHERE program_id = ?
          AND semester_number = ?
        LIMIT 1
        `,
        [programId, semesterValue]
      );

    }

    if (semesterRows.length === 0) {
      return res.status(400).json({
        message: `Semester "${semesterValue}" not found for selected program`
      });
    }

    const semesterId = semesterRows[0].id;


    // ==================================================
    // NORMALIZE CSV DATA
    // ==================================================

    const normalizedData = data
      .map(row => ({

        course_code: String(
          row.course_code || row.code || ""
        ).trim(),

        subject_name: String(
          row.subject_name || row.name || ""
        ).trim(),

        course_type: String(
          row.course_type || ""
        ).trim(),

        elective_group: String(
          row.elective_group || ""
        ).trim(),

        lecture_hours: Number(
          row.L ?? row.l ?? row.lecture_hours ?? 0
        ),

        tutorial_hours: Number(
          row.T ?? row.t ?? row.tutorial_hours ?? 0
        ),

        practical_hours: Number(
          row.P ?? row.p ?? row.practical_hours ?? 0
        ),

        credits: String(
          row.credits ?? ""
        ).trim()

      }))
      .filter(row =>
        row.course_code &&
        row.subject_name
      );


    if (normalizedData.length === 0) {
      return res.status(400).json({
        message: "No valid subject data received"
      });
    }


    // ==================================================
    // VALIDATE L/T/P VALUES
    // ==================================================

    const invalidRow = normalizedData.find(row =>
      !Number.isInteger(row.lecture_hours) ||
      !Number.isInteger(row.tutorial_hours) ||
      !Number.isInteger(row.practical_hours) ||
      row.lecture_hours < 0 ||
      row.tutorial_hours < 0 ||
      row.practical_hours < 0
    );

    if (invalidRow) {
      return res.status(400).json({
        message: `Invalid L/T/P hours for course ${invalidRow.course_code}`
      });
    }


    // ==================================================
    // GET COURSE CODES FROM CSV
    // ==================================================

    const courseCodes = normalizedData.map(
      row => row.course_code
    );

    const placeholders = courseCodes
      .map(() => "?")
      .join(",");


    // ==================================================
    // FIND EXISTING SUBJECTS
    // ==================================================

    const selectSql = `
      SELECT
        id,
        course_code,
        subject_name,
        course_type,
        elective_group,
        lecture_hours,
        tutorial_hours,
        practical_hours,
        credits

      FROM subjects

      WHERE course_code IN (${placeholders})
        AND program_id = ?
        AND department_id = ?
        AND semester_id = ?
    `;

    const [existingRows] = await db.query(
      selectSql,
      [
        ...courseCodes,
        programId,
        departmentId,
        semesterId
      ]
    );


    // ==================================================
    // CREATE EXISTING SUBJECT MAP
    // ==================================================

    const existingMap = new Map();

    existingRows.forEach(row => {
      existingMap.set(
        String(row.course_code).trim(),
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
    // CHECK EACH CSV ROW
    // ==================================================

    normalizedData.forEach(row => {

      const existing = existingMap.get(row.course_code);

      if (!existing) {
        inserted++;
        return;
      }

      const isSame =

        String(existing.subject_name || "").trim()
          === row.subject_name

        &&

        String(existing.course_type || "").trim()
          === row.course_type

        &&

        String(existing.elective_group || "").trim()
          === row.elective_group

        &&

        Number(existing.lecture_hours || 0)
          === row.lecture_hours

        &&

        Number(existing.tutorial_hours || 0)
          === row.tutorial_hours

        &&

        Number(existing.practical_hours || 0)
          === row.practical_hours

        &&

        String(existing.credits ?? "").trim()
          === row.credits;

      if (isSame) {
        unchanged++;
      } else {
        updated++;
      }

    });


    // ==================================================
    // PREPARE BULK VALUES
    // ==================================================

    const values = normalizedData.map(row => [

      row.course_code,
      row.subject_name,
      programId,
      departmentId,
      semesterId,
      row.course_type,
      row.elective_group || null,
      row.lecture_hours,
      row.tutorial_hours,
      row.practical_hours,
      row.credits

    ]);


    // ==================================================
    // BULK UPSERT
    // ==================================================

    const upsertSql = `
      INSERT INTO subjects
      (
        course_code,
        subject_name,
        program_id,
        department_id,
        semester_id,
        course_type,
        elective_group,
        lecture_hours,
        tutorial_hours,
        practical_hours,
        credits
      )

      VALUES ?

      ON DUPLICATE KEY UPDATE

        subject_name = VALUES(subject_name),
        course_type = VALUES(course_type),
        elective_group = VALUES(elective_group),
        lecture_hours = VALUES(lecture_hours),
        tutorial_hours = VALUES(tutorial_hours),
        practical_hours = VALUES(practical_hours),
        credits = VALUES(credits)
    `;

    await db.query(upsertSql, [values]);


    // ==================================================
    // RESPONSE
    // ==================================================

    return res.json({

      success: true,

      message: "Subjects imported successfully",

      total: normalizedData.length,

      inserted,
      updated,
      unchanged

    });

  }

  catch (error) {

    console.error(
      "SUBJECT IMPORT ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      message: "Subject import failed",

      error: error.message

    });

  }

};

// ==================================================
// GET SUBJECTS
// ==================================================

exports.getSubjects = async (req, res) => {

  try {

    const {
      program,
      department,
      semester
    } = req.query;


    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (!program || !department || !semester) {

      return res.status(400).json({

        success: false,

        message: "Program, department and semester are required"

      });

    }


    // ==================================================
    // GET PROGRAM (SUPPORT ID OR NAME)
    // ==================================================

    const programValue = String(program).trim();

    let programRows;

    if (/^\d+$/.test(programValue)) {

      [programRows] = await db.query(
        `
        SELECT id, program_name
        FROM programs
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
        `,
        [Number(programValue)]
      );

    } else {

      [programRows] = await db.query(
        `
        SELECT id, program_name
        FROM programs
        WHERE (
          program_name = ?
          OR UPPER(REPLACE(program_name, '.', '')) = ?
        )
          AND is_active = 1
        LIMIT 1
        `,
        [
          programValue,
          programValue.toUpperCase().replace(/\./g, '')
        ]
      );

    }

    if (programRows.length === 0) {

      return res.status(404).json({

        success: false,

        message: `Program "${programValue}" not found`

      });

    }

    const programId = programRows[0].id;


    // ==================================================
    // GET DEPARTMENT (SUPPORT ID OR NAME)
    // ==================================================

    const departmentValue = String(department).trim();

    let departmentRows;

    if (/^\d+$/.test(departmentValue)) {

      [departmentRows] = await db.query(
        `
        SELECT
          d.id,
          d.name,
          d.abbreviation

        FROM departments d

        INNER JOIN program_departments pd
          ON pd.department_id = d.id

        WHERE d.id = ?
          AND pd.program_id = ?
          AND d.is_active = 1
          AND pd.is_active = 1

        LIMIT 1
        `,
        [
          Number(departmentValue),
          programId
        ]
      );

    } else {

      [departmentRows] = await db.query(
        `
        SELECT
          d.id,
          d.name,
          d.abbreviation

        FROM departments d

        INNER JOIN program_departments pd
          ON pd.department_id = d.id

        WHERE (
          d.name = ?
          OR d.abbreviation = ?
        )
          AND pd.program_id = ?
          AND d.is_active = 1
          AND pd.is_active = 1

        LIMIT 1
        `,
        [
          departmentValue,
          departmentValue,
          programId
        ]
      );

    }

    if (departmentRows.length === 0) {

      return res.status(404).json({

        success: false,

        message: `Department "${departmentValue}" not found for selected program`

      });

    }

    const departmentId = departmentRows[0].id;


    // ==================================================
    // GET SEMESTER (SUPPORT ID OR SEMESTER NUMBER)
    // ==================================================

    const semesterValue = Number(semester);

    if (
      !Number.isInteger(semesterValue) ||
      semesterValue <= 0
    ) {

      return res.status(400).json({

        success: false,

        message: "Invalid semester"

      });

    }

    let semesterRows;

    // First, check using semester database ID.
    [semesterRows] = await db.query(
      `
      SELECT
        id,
        semester_number,
        semester_name

      FROM semesters

      WHERE id = ?
        AND program_id = ?

      LIMIT 1
      `,
      [
        semesterValue,
        programId
      ]
    );

    // Backward compatibility: check semester number.
    if (semesterRows.length === 0) {

      [semesterRows] = await db.query(
        `
        SELECT
          id,
          semester_number,
          semester_name

        FROM semesters

        WHERE program_id = ?
          AND semester_number = ?

        LIMIT 1
        `,
        [
          programId,
          semesterValue
        ]
      );

    }

    if (semesterRows.length === 0) {

      return res.status(404).json({

        success: false,

        message: `Semester "${semesterValue}" not found for selected program`

      });

    }

    const semesterId = semesterRows[0].id;


    // ==================================================
    // GET SUBJECTS
    // ==================================================

    const [rows] = await db.query(
      `
      SELECT

        s.id,

        s.course_code,

        s.subject_name,

        s.program_id,

        s.department_id,

        s.semester_id,

        p.program_name AS program,

        d.name AS department,

        d.abbreviation AS department_abbreviation,

        sem.semester_number,

        sem.semester_name AS semester,

        s.course_type,

        s.elective_group,

        s.lecture_hours,

        s.tutorial_hours,

        s.practical_hours,

        s.credits

      FROM subjects s

      INNER JOIN programs p
        ON p.id = s.program_id

      INNER JOIN departments d
        ON d.id = s.department_id

      INNER JOIN semesters sem
        ON sem.id = s.semester_id

      WHERE
        s.program_id = ?
        AND s.department_id = ?
        AND s.semester_id = ?
        AND s.is_active = 1

      ORDER BY s.course_code
      `,
      [
        programId,
        departmentId,
        semesterId
      ]
    );


    // ==================================================
    // RESPONSE
    // ==================================================

    return res.json(rows);

  }

  catch (error) {

    console.error(
      "GET SUBJECTS ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      message: "Failed to load subjects",

      error: error.message

    });

  }

};

// ==================================================
// ADD SUBJECT
// ==================================================

exports.addSubject = async (req, res) => {

    const {
        course_code,
        subject_name,
        program,
        department,
        semester,
        course_type,
        elective_group,
        credits,
        L,
        T,
        P
    } = req.body;


    // ----------------------------------------------
    // VALIDATION
    // ----------------------------------------------

    if (!course_code) {
        return res.status(400).json({
            success: false,
            message: "Course code is required"
        });
    }

    if (!subject_name) {
        return res.status(400).json({
            success: false,
            message: "Subject name is required"
        });
    }

    if (!program) {
        return res.status(400).json({
            success: false,
            message: "Program is required"
        });
    }

    if (!department) {
        return res.status(400).json({
            success: false,
            message: "Department is required"
        });
    }

    if (
        semester === undefined ||
        semester === null ||
        semester === ""
    ) {
        return res.status(400).json({
            success: false,
            message: "Semester is required"
        });
    }


    try {

        // ------------------------------------------
        // NORMALIZE BASIC VALUES
        // ------------------------------------------

        const normalizedCourseCode =
            String(course_code)
            .trim()
            .toUpperCase();

        const normalizedSubjectName =
            String(subject_name)
                .trim();

        const normalizedProgram =
            String(program)
                .trim();

        const normalizedDepartment =
            String(department)
                .trim();


        // ------------------------------------------
        // CHECK DUPLICATE COURSE CODE
        // ------------------------------------------

        const [existing] = await db.query(
            `
            SELECT id
            FROM subjects
            WHERE course_code = ?
            LIMIT 1
            `,
            [
                normalizedCourseCode
            ]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Course code "${normalizedCourseCode}" already exists`
            });
        }


        // ----------------------------------------------
        // GET PROGRAM ID
        // SUPPORT ID OR PROGRAM NAME
        // ----------------------------------------------

        let programRows;

        if (/^\d+$/.test(normalizedProgram)) {

            [programRows] = await db.query(
                `
                SELECT id
                FROM programs
                WHERE id = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [Number(normalizedProgram)]
            );

        } else {

            [programRows] = await db.query(
                `
                SELECT id
                FROM programs
                WHERE program_name = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [normalizedProgram]
            );

        }

        if (programRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Program "${normalizedProgram}" not found`
            });
        }

        const program_id = programRows[0].id;


        // ----------------------------------------------
        // GET DEPARTMENT ID
        // SUPPORT ID, NAME OR ABBREVIATION
        // VERIFY DEPARTMENT BELONGS TO PROGRAM
        // ----------------------------------------------

        let departmentRows;

        if (/^\d+$/.test(normalizedDepartment)) {

            [departmentRows] = await db.query(
                `
                SELECT d.id
                FROM departments d
                INNER JOIN program_departments pd
                    ON pd.department_id = d.id
                WHERE d.id = ?
                  AND pd.program_id = ?
                  AND d.is_active = 1
                  AND pd.is_active = 1
                LIMIT 1
                `,
                [
                    Number(normalizedDepartment),
                    program_id
                ]
            );

        } else {

            [departmentRows] = await db.query(
                `
                SELECT d.id
                FROM departments d
                INNER JOIN program_departments pd
                    ON pd.department_id = d.id
                WHERE (
                    d.name = ?
                    OR d.abbreviation = ?
                )
                  AND pd.program_id = ?
                  AND d.is_active = 1
                  AND pd.is_active = 1
                LIMIT 1
                `,
                [
                    normalizedDepartment,
                    normalizedDepartment,
                    program_id
                ]
            );

        }

        if (departmentRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Department "${normalizedDepartment}" not found for selected program`
            });
        }

        const department_id = departmentRows[0].id;


        // ----------------------------------------------
        // GET SEMESTER ID
        // ANGULAR SENDS SEMESTER TABLE ID
        // ----------------------------------------------

        const semester_id = Number(semester);

        if (!Number.isInteger(semester_id) || semester_id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid semester ID"
            });
        }


        // ----------------------------------------------
        // VERIFY SEMESTER BELONGS TO PROGRAM
        // ----------------------------------------------

        const [semesterRows] = await db.query(
            `
            SELECT id
            FROM semesters
            WHERE id = ?
              AND program_id = ?
            LIMIT 1
            `,
            [
                semester_id,
                program_id
            ]
        );

        if (semesterRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Semester ID "${semester_id}" does not belong to program "${normalizedProgram}"`
            });
        }


        // ----------------------------------------------
        // NORMALIZE OPTIONAL VALUES
        // ----------------------------------------------

        const normalizedCourseType = course_type
            ? String(course_type).trim()
            : null;

        const normalizedElectiveGroup = elective_group
            ? String(elective_group).trim()
            : null;

        const normalizedCredits =
            credits !== undefined && credits !== null
                ? String(credits).trim()
                : null;


        // ----------------------------------------------
        // VALIDATE LECTURE / TUTORIAL / PRACTICAL HOURS
        // ----------------------------------------------

        const lectureHours = Number(L ?? 0);
        const tutorialHours = Number(T ?? 0);
        const practicalHours = Number(P ?? 0);

        if (
            !Number.isInteger(lectureHours) ||
            !Number.isInteger(tutorialHours) ||
            !Number.isInteger(practicalHours) ||
            lectureHours < 0 ||
            tutorialHours < 0 ||
            practicalHours < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "L, T and P hours must be non-negative integers"
            });
        }


        // ----------------------------------------------
        // INSERT SUBJECT
        // ----------------------------------------------

        const [result] = await db.query(
            `
            INSERT INTO subjects
            (
                course_code,
                subject_name,
                program_id,
                department_id,
                semester_id,
                course_type,
                elective_group,
                lecture_hours,
                tutorial_hours,
                practical_hours,
                credits,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                normalizedCourseCode,
                normalizedSubjectName,
                program_id,
                department_id,
                semester_id,
                normalizedCourseType,
                normalizedElectiveGroup,
                lectureHours,
                tutorialHours,
                practicalHours,
                normalizedCredits,
                1
            ]
        );


        // ----------------------------------------------
        // SUCCESS RESPONSE
        // ----------------------------------------------

        return res.status(201).json({
            success: true,
            message: "Subject added successfully",
            id: result.insertId
        });

    } catch (err) {

        console.error("Failed to add subject:", err);

        // ----------------------------------------------
        // HANDLE DUPLICATE ENTRY
        // ----------------------------------------------

        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A subject with this course code already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to add subject",
            error: err.message
        });

    }

};

// ==================================================
// UPDATE SUBJECT
// ==================================================

exports.updateSubject = async (req, res) => {

  const { id } = req.params;

  const {
    course_code,
    subject_name,
    program,
    department,
    semester,
    course_type,
    elective_group,
    credits,
    L,
    T,
    P
  } = req.body;

  try {

    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (!course_code || !String(course_code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Course code is required"
      });
    }

    if (!subject_name || !String(subject_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required"
      });
    }

    if (!program) {
      return res.status(400).json({
        success: false,
        message: "Program is required"
      });
    }

    if (!department) {
      return res.status(400).json({
        success: false,
        message: "Department is required"
      });
    }

    if (
      semester === undefined ||
      semester === null ||
      semester === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Semester is required"
      });
    }


    // ==================================================
    // CHECK SUBJECT EXISTS
    // ==================================================

    const [subjectRows] = await db.query(
      `
      SELECT id
      FROM subjects
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }


    // ==================================================
    // GET PROGRAM ID (SUPPORT ID OR NAME)
    // ==================================================

    const programValue = String(program).trim();

    let programRows;

    if (/^\d+$/.test(programValue)) {

      [programRows] = await db.query(
        `
        SELECT id
        FROM programs
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
        `,
        [Number(programValue)]
      );

    } else {

      [programRows] = await db.query(
        `
        SELECT id
        FROM programs
        WHERE program_name = ?
          AND is_active = 1
        LIMIT 1
        `,
        [programValue]
      );

    }

    if (programRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Program "${programValue}" not found`
      });
    }

    const program_id = programRows[0].id;


    // ==================================================
    // GET DEPARTMENT ID (SUPPORT ID OR NAME)
    // ==================================================

    const departmentValue = String(department).trim();

    let departmentRows;

    if (/^\d+$/.test(departmentValue)) {

      [departmentRows] = await db.query(
        `
        SELECT d.id
        FROM departments d
        INNER JOIN program_departments pd
          ON pd.department_id = d.id
        WHERE d.id = ?
          AND pd.program_id = ?
          AND d.is_active = 1
          AND pd.is_active = 1
        LIMIT 1
        `,
        [
          Number(departmentValue),
          program_id
        ]
      );

    } else {

      [departmentRows] = await db.query(
        `
        SELECT d.id
        FROM departments d
        INNER JOIN program_departments pd
          ON pd.department_id = d.id
        WHERE (
          d.name = ?
          OR d.abbreviation = ?
        )
          AND pd.program_id = ?
          AND d.is_active = 1
          AND pd.is_active = 1
        LIMIT 1
        `,
        [
          departmentValue,
          departmentValue,
          program_id
        ]
      );

    }

    if (departmentRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid department for selected program"
      });
    }

    const department_id = departmentRows[0].id;


    // ==================================================
    // GET SEMESTER ID (SUPPORT ID OR SEMESTER NUMBER)
    // ==================================================

    const semesterValue = Number(semester);

    if (
      !Number.isInteger(semesterValue) ||
      semesterValue <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid semester"
      });
    }

    let semesterRows;

    // First check semester database ID.
    [semesterRows] = await db.query(
      `
      SELECT id
      FROM semesters
      WHERE id = ?
        AND program_id = ?
      LIMIT 1
      `,
      [
        semesterValue,
        program_id
      ]
    );

    // Backward compatibility: check semester number.
    if (semesterRows.length === 0) {

      [semesterRows] = await db.query(
        `
        SELECT id
        FROM semesters
        WHERE program_id = ?
          AND semester_number = ?
        LIMIT 1
        `,
        [
          program_id,
          semesterValue
        ]
      );

    }

    if (semesterRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Semester "${semesterValue}" not found for selected program`
      });
    }

    const semester_id = semesterRows[0].id;


    // ==================================================
    // CHECK DUPLICATE COURSE CODE
    // ==================================================

    const normalizedCourseCode = String(course_code)
      .trim()
      .toUpperCase();

    const [duplicateRows] = await db.query(
      `
      SELECT id
      FROM subjects
      WHERE UPPER(course_code) = ?
        AND id != ?
      LIMIT 1
      `,
      [
        normalizedCourseCode,
        id
      ]
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Course code "${normalizedCourseCode}" already exists`
      });
    }


    // ==================================================
    // NORMALIZE VALUES
    // ==================================================

    const normalizedSubjectName = String(subject_name).trim();

    const normalizedCourseType = course_type
      ? String(course_type).trim()
      : null;

    const normalizedElectiveGroup = elective_group
      ? String(elective_group).trim()
      : null;

    const normalizedCredits =
      credits !== undefined && credits !== null
        ? String(credits).trim()
        : null;

    const lectureHours = Number(L ?? 0);
    const tutorialHours = Number(T ?? 0);
    const practicalHours = Number(P ?? 0);


    // ==================================================
    // VALIDATE L/T/P
    // ==================================================

    if (
      !Number.isInteger(lectureHours) ||
      !Number.isInteger(tutorialHours) ||
      !Number.isInteger(practicalHours) ||
      lectureHours < 0 ||
      tutorialHours < 0 ||
      practicalHours < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "L, T and P hours must be non-negative integers"
      });
    }


    // ==================================================
    // UPDATE SUBJECT
    // ==================================================

    await db.query(
      `
      UPDATE subjects
      SET
        course_code = ?,
        subject_name = ?,
        program_id = ?,
        department_id = ?,
        semester_id = ?,
        course_type = ?,
        elective_group = ?,
        lecture_hours = ?,
        tutorial_hours = ?,
        practical_hours = ?,
        credits = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        normalizedCourseCode,
        normalizedSubjectName,
        program_id,
        department_id,
        semester_id,
        normalizedCourseType,
        normalizedElectiveGroup,
        lectureHours,
        tutorialHours,
        practicalHours,
        normalizedCredits,
        id
      ]
    );


    // ==================================================
    // SUCCESS RESPONSE
    // ==================================================

    return res.json({
      success: true,
      message: "Subject updated successfully"
    });

  }

  catch (err) {

    console.error(
      "Failed to update subject:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update subject",
      error: err.message
    });

  }

};

// ==================================================
// DELETE SUBJECT
// ==================================================

exports.deleteSubject = async (req, res) => {

    const { id } = req.params;

    try {

        // ------------------------------------------
        // CHECK SUBJECT EXISTS
        // ------------------------------------------

        const [subject] = await db.query(
            `
            SELECT id
            FROM subjects
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (subject.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Subject not found"

            });

        }

        // ------------------------------------------
        // DELETE
        // ------------------------------------------

        await db.query(
            `
            DELETE FROM subjects
            WHERE id = ?
            `,
            [id]
        );

        return res.json({

            success: true,

            message:
                "Subject deleted successfully"

        });

    } catch (err) {

        console.error(
            "Failed to delete subject:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to delete subject",

            error:
                err.message

        });

    }

};