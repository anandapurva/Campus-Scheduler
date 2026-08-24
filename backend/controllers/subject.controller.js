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


  // ==================================================
  // BASIC VALIDATION
  // ==================================================

  if (
    !program ||
    !department ||
    !semester
  ) {

    return res.status(400).json({
      message:
        "Program, department and semester are required"
    });

  }


  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {

    return res.status(400).json({
      message:
        "No subject data received"
    });

  }


  // ==================================================
  // GET PROGRAM ID
  // ==================================================

  try {

    const [programRows] = await db.query(

      `
      SELECT id

      FROM programs

      WHERE program_name = ?
        AND is_active = 1

      LIMIT 1
      `,

      [
        String(program).trim()
      ]

    );


    if (programRows.length === 0) {

      return res.status(400).json({
        message:
          "Invalid program"
      });

    }


    const programId =
      programRows[0].id;


    // ==================================================
    // GET DEPARTMENT ID
    // ==================================================

    const [departmentRows] = await db.query(

      `
      SELECT
        d.id

      FROM departments d

      INNER JOIN program_departments pd
        ON pd.department_id = d.id

      WHERE d.name = ?
        AND pd.program_id = ?
        AND d.is_active = 1
        AND pd.is_active = 1

      LIMIT 1
      `,

      [
        String(department).trim(),
        programId
      ]

    );


    if (departmentRows.length === 0) {

      return res.status(400).json({
        message:
          "Invalid department for selected program"
      });

    }


    const departmentId =
      departmentRows[0].id;


    // ==================================================
    // GET SEMESTER ID
    // ==================================================

    const semesterId =
      Number(semester);


    if (
      !Number.isInteger(semesterId) ||
      semesterId <= 0
    ) {

      return res.status(400).json({
        message:
          "Invalid semester"
      });

    }


    const [semesterRows] = await db.query(

      `
      SELECT id

      FROM semesters

      WHERE id = ?
        AND program_id = ?

      LIMIT 1
      `,

      [
        semesterId,
        programId
      ]

    );


    if (semesterRows.length === 0) {

      return res.status(400).json({
        message:
          "Invalid semester for selected program"
      });

    }


    // ==================================================
    // NORMALIZE CSV DATA
    // ==================================================

    const normalizedData = data
      .map(row => ({

        course_code:
          String(
            row.course_code ||
            row.code ||
            ""
          ).trim(),

        subject_name:
          String(
            row.subject_name ||
            row.name ||
            ""
          ).trim(),

        course_type:
          String(
            row.course_type ||
            ""
          ).trim(),

        elective_group:
          String(
            row.elective_group ||
            ""
          ).trim(),

        lecture_hours:
          Number(
            row.L ||
            row.l ||
            0
          ),

        tutorial_hours:
          Number(
            row.T ||
            row.t ||
            0
          ),

        practical_hours:
          Number(
            row.P ||
            row.p ||
            0
          ),

        credits:
          String(
            row.credits ||
            ""
          ).trim()

      }))
      .filter(row =>
        row.course_code &&
        row.subject_name
      );


    if (normalizedData.length === 0) {

      return res.status(400).json({
        message:
          "No valid subject data received"
      });

    }


    // ==================================================
    // GET COURSE CODES FROM CSV
    // ==================================================

    const courseCodes =
      normalizedData.map(
        row => row.course_code
      );


    // ==================================================
    // FIND EXISTING SUBJECTS
    // ==================================================

    const placeholders =
      courseCodes
        .map(() => "?")
        .join(",");


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


    const [existingRows] =
      await db.query(

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

    const existingMap =
      new Map();


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

      const existing =
        existingMap.get(
          row.course_code
        );


      // ------------------------------------------
      // NEW SUBJECT
      // ------------------------------------------

      if (!existing) {

        inserted++;

        return;

      }


      // ------------------------------------------
      // CHECK IF DATA IS SAME
      // ------------------------------------------

      const isSame =

        String(existing.subject_name || "")
          .trim()
        === row.subject_name

        &&

        String(existing.course_type || "")
          .trim()
        === row.course_type

        &&

        String(existing.elective_group || "")
          .trim()
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

        String(existing.credits || "")
          .trim()
        === row.credits;


      if (isSame) {

        unchanged++;

      }

      else {

        updated++;

      }

    });


    // ==================================================
    // PREPARE BULK VALUES
    // ==================================================

    const values =
      normalizedData.map(row => [

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

        subject_name =
          VALUES(subject_name),

        course_type =
          VALUES(course_type),

        elective_group =
          VALUES(elective_group),

        lecture_hours =
          VALUES(lecture_hours),

        tutorial_hours =
          VALUES(tutorial_hours),

        practical_hours =
          VALUES(practical_hours),

        credits =
          VALUES(credits)

    `;


    // ==================================================
    // EXECUTE ONE BULK QUERY
    // ==================================================

    const [result] =
      await db.query(

        upsertSql,

        [values]

      );


    // ==================================================
    // RESPONSE
    // ==================================================

    return res.json({

      success: true,

      message:
        "Subjects imported successfully",

      total:
        normalizedData.length,

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

      message:
        "Subject import failed",

      error:
        error.message

    });

  }

};


/*
==================================================
GET SUBJECTS
==================================================
*/

exports.getSubjects = async (req, res) => {

  try {

    const {
      program,
      department,
      semester
    } = req.query;


    let sql = `

      SELECT

        s.id,
        s.course_code,
        s.subject_name,

        s.program_id,
        s.department_id,
        s.semester_id,

        p.program_name AS program,

        d.name AS department,

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

      WHERE 1 = 1

    `;

    const params = [];


    // ==========================================
    // PROGRAM FILTER
    // ==========================================

    if (program) {

      sql += `
        AND p.program_name = ?
      `;

      params.push(
        String(program).trim()
      );

    }


    // ==========================================
    // DEPARTMENT FILTER
    // ==========================================

    if (department) {

      sql += `
        AND d.name = ?
      `;

      params.push(
        String(department).trim()
      );

    }


    // ==========================================
    // SEMESTER FILTER
    // ==========================================

    if (semester) {

      sql += `
        AND sem.id = ?
      `;

      params.push(
        Number(semester)
      );

    }


    // ==========================================
    // ORDER
    // ==========================================

    sql += `
      ORDER BY s.course_code
    `;


    const [rows] =
      await db.query(
        sql,
        params
      );


    res.json(rows);

  }

  catch (error) {

    console.error(
      'GET SUBJECTS ERROR:',
      error
    );

    res.status(500).json({

      message:
        'Failed to load subjects'

    });

  }

};

// ==================================================
// ADD SUBJECT
// ==================================================

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
                message:
                    `Course code "${normalizedCourseCode}" already exists`
            });

        }


        // ------------------------------------------
        // GET PROGRAM ID
        // ------------------------------------------

        const [programRows] = await db.query(
            `
            SELECT id
            FROM programs
            WHERE program_name = ?
            LIMIT 1
            `,
            [
                normalizedProgram
            ]
        );

        if (programRows.length === 0) {

            return res.status(400).json({
                success: false,
                message:
                    `Program "${normalizedProgram}" not found`
            });

        }

        const program_id =
            programRows[0].id;


        // ------------------------------------------
        // GET DEPARTMENT ID
        // ------------------------------------------

        const [departmentRows] = await db.query(
            `
            SELECT id
            FROM departments
            WHERE name = ?
            LIMIT 1
            `,
            [
                normalizedDepartment
            ]
        );

        if (departmentRows.length === 0) {

            return res.status(400).json({
                success: false,
                message:
                    `Department "${normalizedDepartment}" not found`
            });

        }

        const department_id =
            departmentRows[0].id;


        // ------------------------------------------
        // SEMESTER ID
        // ------------------------------------------
        // Angular sends the semester table ID
        // directly.
        // ------------------------------------------

        const semester_id =
            Number(semester);

        if (!Number.isInteger(semester_id)) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid semester ID"
            });

        }


        // ------------------------------------------
        // VERIFY SEMESTER EXISTS
        // ------------------------------------------

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
                message:
                    `Semester ID "${semester_id}" does not belong to program "${normalizedProgram}"`
            });

        }


        // ------------------------------------------
        // NORMALIZE OPTIONAL VALUES
        // ------------------------------------------

        const normalizedCourseType =
            course_type
                ? String(course_type).trim()
                : null;

        const normalizedElectiveGroup =
            elective_group
                ? String(elective_group).trim()
                : null;

        const normalizedCredits =
            credits !== undefined &&
            credits !== null
                ? String(credits).trim()
                : null;


        // ------------------------------------------
        // HOURS
        // ------------------------------------------

        const lectureHours =
            Number(L) || 0;

        const tutorialHours =
            Number(T) || 0;

        const practicalHours =
            Number(P) || 0;


        // ------------------------------------------
        // INSERT SUBJECT
        // ------------------------------------------

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


        // ------------------------------------------
        // SUCCESS
        // ------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                "Subject added successfully",

            id:
                result.insertId

        });


    } catch (err) {

        console.error(
            "Failed to add subject:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to add subject",

            error:
                err.message

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
                message: "Subject not found"
            });

        }

        // ------------------------------------------
        // CHECK DUPLICATE COURSE CODE
        // ------------------------------------------

        const [duplicate] = await db.query(
            `
            SELECT id
            FROM subjects
            WHERE course_code = ?
            AND id != ?
            LIMIT 1
            `,
            [
                String(course_code)
                    .trim()
                    .toUpperCase(),
                id
            ]
        );

        if (duplicate.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    `Course code "${course_code}" already exists`
            });

        }

        // ------------------------------------------
        // GET PROGRAM ID
        // ------------------------------------------

        const [programRows] = await db.query(
            `
            SELECT id
            FROM programs
            WHERE program_name = ?
            LIMIT 1
            `,
            [
                String(program).trim()
            ]
        );

        if (programRows.length === 0) {

            return res.status(400).json({
                success: false,
                message:
                    `Program "${program}" not found`
            });

        }

        const program_id =
            programRows[0].id;


        // ------------------------------------------
        // GET DEPARTMENT ID
        // ------------------------------------------

        const [departmentRows] = await db.query(
            `
            SELECT id
            FROM departments
            WHERE name = ?
            LIMIT 1
            `,
            [
                String(department).trim()
            ]
        );

        if (departmentRows.length === 0) {

            return res.status(400).json({
                success: false,
                message:
                    `Department "${department}" not found`
            });

        }

        const department_id =
            departmentRows[0].id;


        // ------------------------------------------
        // GET SEMESTER ID
        // ------------------------------------------
        // Semester is linked to the program,
        // so check BOTH program_id and semester_number.
        // ------------------------------------------

const semester_id = Number(semester);

if (!Number.isInteger(semester_id)) {

    return res.status(400).json({
        success: false,
        message: "Invalid semester ID"
    });

}


        // ------------------------------------------
        // NORMALIZE VALUES
        // ------------------------------------------

        const normalizedCourseCode =
            String(course_code)
                .trim()
                .toUpperCase();

        const normalizedSubjectName =
            String(subject_name)
                .trim();

        const normalizedCourseType =
            course_type
                ? String(course_type).trim()
                : null;

        const normalizedElectiveGroup =
            elective_group
                ? String(elective_group).trim()
                : null;

        const normalizedCredits =
            credits !== undefined &&
            credits !== null
                ? String(credits).trim()
                : null;

        const lectureHours =
            Number(L) || 0;

        const tutorialHours =
            Number(T) || 0;

        const practicalHours =
            Number(P) || 0;


        // ------------------------------------------
        // UPDATE SUBJECT
        // ------------------------------------------

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


        // ------------------------------------------
        // SUCCESS
        // ------------------------------------------

        return res.json({

            success: true,

            message:
                "Subject updated successfully"

        });


    } catch (err) {

        console.error(
            "Failed to update subject:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to update subject",

            error:
                err.message

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