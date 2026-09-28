const express = require('express');

const router = express.Router();

const departmentController =
    require('../controllers/department.controller');


// ==========================================
// GET DEPARTMENTS BY PROGRAM
// ==========================================

router.get(
    '/by-program',
    departmentController.getDepartmentsByProgram
);


// ==========================================
// GET ALL DEPARTMENTS
// ADMIN
// ==========================================

router.get(
    '/',
    departmentController.getAllDepartments
);


// ==========================================
// CREATE
// ==========================================

router.post(
    '/',
    departmentController.createDepartment
);


// ==========================================
// UPDATE
// ==========================================

router.put(
    '/:id',
    departmentController.updateDepartment
);


// ==========================================
// ACTIVATE / DEACTIVATE
// ==========================================

router.patch(
    '/:id/status',
    departmentController.updateDepartmentStatus
);

router.get(
    '/:departmentId/programs',
    departmentController.getProgramsByDepartment
);


module.exports = router;