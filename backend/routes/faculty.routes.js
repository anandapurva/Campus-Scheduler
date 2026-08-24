const express = require("express");
const multer = require("multer");

const facultyController =
    require("../controllers/faculty.controller");

const router = express.Router();


// --------------------------------------
// MULTER CONFIGURATION
// --------------------------------------

const upload = multer({

    dest: "uploads/",

    fileFilter: (req, file, cb) => {

        const allowedTypes = [

            "text/csv",

            "application/vnd.ms-excel",

            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        ];


        if (
            allowedTypes.includes(
                file.mimetype
            )
        ) {

            cb(null, true);

        }
        else {

            cb(
                new Error(
                    "Only CSV and Excel files are allowed"
                )
            );

        }

}

});


// --------------------------------------
// ROUTES
// --------------------------------------

// Upload CSV → Preview

router.post(
    "/preview",
    upload.single("file"),
    facultyController.previewFaculty
);


// Preview data → MySQL

router.post(
    "/import",
    facultyController.importFaculty
);


// Get faculty

router.get(
    "/",
    facultyController.getFaculty
);

// --------------------------------------
// ADD FACULTY
// --------------------------------------

router.post(
    "/",
    facultyController.addFaculty
);


// --------------------------------------
// UPDATE FACULTY
// --------------------------------------

router.put(
    "/:id",
    facultyController.updateFaculty
);


// --------------------------------------
// DELETE FACULTY
// --------------------------------------

router.delete(
    "/:id",
    facultyController.deleteFaculty
);


// --------------------------------------
// GET FACULTY
// --------------------------------------

router.get(
    "/",
    facultyController.getFaculty
);


module.exports = router;