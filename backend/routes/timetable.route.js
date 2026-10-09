const express = require('express');
const router = express.Router();

const timetableController = require('../controllers/timetable.controller');

// ======================================================
// CREATE TIMETABLE ENTRY
// ======================================================

router.post(
    '/',
    timetableController.createTimetableEntry
);

router.get(
    '/',
    timetableController.getTimetable
);

router.get(
    '/locked-resources',
    timetableController.getLockedResources
);

router.post(
    '/finalize',
    timetableController.finalizeTimetable
);

router.post(
    '/unfinalize',
    timetableController.unfinalizeTimetable
);

router.get(
    '/status',
    timetableController.getTimetableStatus
);
router.get('/hours', timetableController.getSubjectHours);

router.post(
  '/practical-availability',
  timetableController.checkPracticalAvailability
);

module.exports = router;
