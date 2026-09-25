const express = require('express');

const router = express.Router();

const programController =
    require('../controllers/program.controller');


// ==========================================
// ACTIVE PROGRAMS
// ==========================================

router.get(
    '/',
    programController.getPrograms
);


// ==========================================
// ADMIN - ALL PROGRAMS
// ==========================================

router.get(
    '/all',
    programController.getAllPrograms
);


// ==========================================
// CREATE PROGRAM
// ==========================================

router.post(
    '/',
    programController.createProgram
);


// ==========================================
// UPDATE PROGRAM
// ==========================================

router.put(
    '/:id',
    programController.updateProgram
);


// ==========================================
// ACTIVATE / DEACTIVATE
// ==========================================

router.patch(
    '/:id/status',
    programController.updateProgramStatus
);


// ==========================================
// GET SEMESTERS
// IMPORTANT: keep this BEFORE nothing
// that would conflict with :id
// ==========================================

router.get(
    '/:programId/semesters',
    programController.getSemestersByProgram
);


module.exports = router;