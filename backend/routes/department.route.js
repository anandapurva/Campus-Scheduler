const express = require("express");

const departmentController =
    require("../controllers/department.controller");

const router = express.Router();


// ==========================================
// GET DEPARTMENTS BY PROGRAM
// ==========================================

router.get(
    "/by-program",
    departmentController.getDepartmentsByProgram
);

router.get(
    "/",
    departmentController.getAllDepartments
);


module.exports = router;