const db = require("../config/db");

async function getScheduledHours(
  batchId,
  subjectId,
  academicSessionId
) {
  const [rows] = await db.query(
    `
    SELECT te.lecture_type
    FROM timetable_entries te
    INNER JOIN timetable_entry_batches teb
      ON teb.timetable_entry_id = te.id
    WHERE teb.batch_id = ?
      AND te.subject_id = ?
      AND te.academic_session_id = ?
    `,
    [batchId, subjectId, academicSessionId]
  );

  const scheduled = { L: 0, T: 0, P: 0 };

  for (const row of rows) {
    if (row.lecture_type === "L") scheduled.L++;
    else if (row.lecture_type === "T") scheduled.T++;
    else if (row.lecture_type === "P") scheduled.P++;
  }

  return scheduled;
}

async function getSubjectsAndBatches({
  programId,
  departmentId,
  semesterId
}) {
  const [subjects] = await db.query(
    `
    SELECT
      id,
      course_code,
      subject_name,
      lecture_hours,
      tutorial_hours,
      practical_hours
    FROM subjects
    WHERE program_id = ?
      AND department_id = ?
      AND semester_id = ?
      AND is_active = 1
    `,
    [programId, departmentId, semesterId]
  );

const [batches] = await db.query(`
    SELECT
        b.id AS batch_id,
        b.batch_code,
        b.program,
        b.batch_type,
        s.id AS semester_id,
        s.semester_number
    FROM batches b
    INNER JOIN programs p
        ON p.id = ?
    INNER JOIN departments d
        ON d.id = ?
    INNER JOIN semesters s
        ON s.id = ?
        AND s.program_id = p.id
    WHERE
        UPPER(REPLACE(TRIM(p.program_name), '.', '')) =
        UPPER(REPLACE(TRIM(b.program), '.', ''))
        AND (
            LOWER(TRIM(d.abbreviation)) = LOWER(TRIM(b.department))
            OR LOWER(TRIM(d.name)) = LOWER(TRIM(b.department))
        )
        AND b.is_active = 1
`, [programId, departmentId, semesterId]);

  return { subjects, batches };
}

async function validateTimetableCompletion({
  academicSessionId,
  programId,
  departmentId,
  semesterId
}) {
  const { subjects, batches } = await getSubjectsAndBatches({
    programId,
    departmentId,
    semesterId
  });

  const errors = [];

  if (batches.length === 0) {
    errors.push({
      type: "NO_BATCHES",
      message:
        "No active batches were found for the selected program, department, and semester."
    });
  }

  if (subjects.length === 0) {
    errors.push({
      type: "NO_SUBJECTS",
      message:
        "No active subjects were found for the selected program, department, and semester."
    });
  }

  for (const batch of batches) {
    for (const subject of subjects) {
      const required = {
        L: Number(subject.lecture_hours || 0),
        T: Number(subject.tutorial_hours || 0),
        P: Number(subject.practical_hours || 0)
      };

      const scheduled = await getScheduledHours(
        batch.batch_id,
        subject.id,
        academicSessionId
      );

      const missing = {
        L: Math.max(0, required.L - scheduled.L),
        T: Math.max(0, required.T - scheduled.T),
        P: Math.max(0, required.P - scheduled.P)
      };

      const excess = {
        L: Math.max(0, scheduled.L - required.L),
        T: Math.max(0, scheduled.T - required.T),
        P: Math.max(0, scheduled.P - required.P)
      };

      if (
        missing.L > 0 ||
        missing.T > 0 ||
        missing.P > 0 ||
        excess.L > 0 ||
        excess.T > 0 ||
        excess.P > 0
      ) {
        errors.push({
          batchId: batch.batch_id,
          batchCode: batch.batch_code,
          subjectId: subject.id,
          courseCode: subject.course_code,
          subjectName: subject.subject_name,
          required,
          scheduled,
          missing,
          excess
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  getScheduledHours,
  validateTimetableCompletion
};