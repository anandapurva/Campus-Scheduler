const express = require('express');

const router = express.Router();

const {
    getAllAcademicSessions,
    getActiveAcademicSession,
    addAcademicSession,
    activateAcademicSession,
    deactivateAllAcademicSessions
} = require('../controllers/academicSessionController');

router.get('/', getAllAcademicSessions);

router.get('/active', getActiveAcademicSession);

router.post('/', addAcademicSession);

router.put('/:id/activate', activateAcademicSession);

router.put('/deactivate-all', deactivateAllAcademicSessions);

module.exports = router;