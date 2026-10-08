const express = require('express');

const router = express.Router();

const timetableController =
    require('../controllers/timetable.controller');


router.post(
    '/',
    timetableController.createTimetableEntry
);

router.put(
    '/:id',
    timetableController.updateTimetableEntry
);

router.delete(
    '/:id',
    timetableController.deleteTimetableEntry
);

router.get(
    '/',
    timetableController.getTimetable
);

router.get(
    '/locked-resources',
    timetableController.getLockedResources
);


module.exports = router;