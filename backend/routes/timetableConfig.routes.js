const express = require("express");

const router = express.Router();

const timetableConfigController =
    require("../controllers/timetableConfig.controller");


// LOCK LUNCH

router.post(
    "/lock-lunch",
    timetableConfigController.lockLunch
);


// router.post(
//     "/lock-lunch",
//     (req, res, next) => {

//         console.log("LOCK LUNCH ROUTE HIT");
//         console.log("REQUEST BODY:", req.body);

//         next();

//     },
//     timetableConfigController.lockLunch
// );



// GET LOCKED LUNCH

router.get(
    "/lunch",
    timetableConfigController.getLunchConfiguration
);


module.exports = router;