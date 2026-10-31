const express = require("express");

const router = express.Router();

const controller =
    require("../controllers/teacher-edit-access.controller");


router.get(
    "/teachers",
    controller.getTeachers
);


router.put(
    "/grant",
    controller.grantEditAccess
);


router.put(
    "/revoke",
    controller.revokeEditAccess
);


module.exports = router;