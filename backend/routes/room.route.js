const express = require("express");
const multer = require("multer");

const roomController =
    require("../controllers/room.controller");

const router =
    express.Router();


// ======================================
// MULTER CONFIGURATION
// ======================================

const upload =
    multer({

        dest: "uploads/",

        fileFilter:
            (req, file, cb) => {

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

                    cb(
                        null,
                        true
                    );

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


// ======================================
// ROUTES
// ======================================


// Upload → Preview

router.post(

    "/preview",

    upload.single("file"),

    roomController.previewRooms

);


// Preview → MySQL

router.post(

    "/import",

    roomController.importRooms

);


// Get rooms

router.get(

    "/",

    roomController.getRooms

);


module.exports = router;