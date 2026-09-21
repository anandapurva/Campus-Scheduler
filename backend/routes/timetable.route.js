const express = require('express');

const router = express.Router();

const timetableController =
    require('../controllers/timetable.controller');


router.post(
    '/',
    timetableController.createTimetableEntry
);


router.get(
    '/',
    timetableController.getTimetable
);


module.exports = router;