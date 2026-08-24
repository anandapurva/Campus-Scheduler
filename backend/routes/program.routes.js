const express = require('express');

const router = express.Router();

const programController =
    require('../controllers/program.controller');


// GET ALL PROGRAMS
router.get(
    '/',
    programController.getPrograms
);


// GET SEMESTERS FOR PROGRAM
router.get(
    '/:programId/semesters',
    programController.getSemestersByProgram
);


module.exports = router;