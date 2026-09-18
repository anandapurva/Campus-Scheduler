const express = require("express");

const router = express.Router();

const timetableConfigController =
    require("../controllers/timetableConfig.controller");


// ============================================================
// LOCK LUNCH
// ============================================================

router.post(
    "/lock-lunch",
    timetableConfigController.lockLunch
);


// ============================================================
// GET LUNCH BY PROGRAM + YEAR
// ============================================================

router.get(
    "/lunch",
    timetableConfigController.getLunchConfiguration
);


// ============================================================
// GET ALL LUNCH CONFIGURATIONS
// ============================================================

router.get(
    "/lunch/all",
    timetableConfigController.getAllLunchConfigurations
);

router.get(
    "/lunch/batch",
    timetableConfigController.getLunchForBatch
);

// ============================================================
// CHANGE LUNCH
// ============================================================

router.put(
    "/lunch/change",
    timetableConfigController.changeLunch
);

module.exports = router;