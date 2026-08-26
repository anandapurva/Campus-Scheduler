const express = require("express");
const multer = require("multer");

const subjectController =
    require("../controllers/subject.controller");

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
            allowedTypes.includes(file.mimetype)
        ) {

            cb(null, true);

        } else {

            cb(
                new Error(
                    "Only CSV and Excel files are allowed"
                )
            );

        }

    }

});


// ==========================================
// PREVIEW CSV / EXCEL
// ==========================================

router.post(
    "/preview",
    upload.single("file"),
    subjectController.previewSubjects
);


// ==========================================
// IMPORT CSV / EXCEL
// ==========================================

router.post(
    "/import",
    upload.single("file"),
    subjectController.importSubjects
);


// ==========================================
// GET ALL SUBJECTS
// ==========================================

router.get( "/", subjectController.getSubjects );

// ADD
router.post('/', subjectController.addSubject);

// UPDATE
router.put('/:id', subjectController.updateSubject);

// DELETE
router.delete('/:id', subjectController.deleteSubject);


module.exports = router;