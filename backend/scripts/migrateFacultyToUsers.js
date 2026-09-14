require("dotenv").config();

const db = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const DOMAIN = "@mail.jiit.ac.in";


/*
=========================================================
REMOVE TITLES ONLY FOR EMAIL GENERATION
=========================================================

IMPORTANT:
This function is ONLY used while creating the email.

faculty.name itself is NEVER changed.

Examples:

Dr. Parnika Jain
    -> Parnika Jain

Prof. Amit Kumar Singh
    -> Amit Kumar Singh

Mrs. Neha Sharma
    -> Neha Sharma
=========================================================
*/
function removeTitle(name) {

    if (!name) {
        return "";
    }

    return name
        .trim()
        .replace(
            /^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?|professor)\s+/i,
            ""
        )
        .replace(/\s+/g, " ")
        .trim();
}


/*
=========================================================
GET FIRST + LAST NAME FOR EMAIL
=========================================================

2 words:

Parnika Jain
    -> Parnika Jain

3 words:

Parnika Kumari Jain
    -> Parnika Jain

4 words:

Parnika Kumari Sharma Jain
    -> Parnika Jain

Middle names are ignored ONLY for email.
=========================================================
*/
function getFirstAndLastName(name) {

    const nameWithoutTitle =
        removeTitle(name);

    const parts =
        nameWithoutTitle
            .split(/\s+/)
            .filter(Boolean);


    if (parts.length === 0) {
        return "";
    }


    if (parts.length === 1) {
        return parts[0];
    }


    const firstName =
        parts[0];

    const lastName =
        parts[parts.length - 1];


    return `${firstName} ${lastName}`;
}


/*
=========================================================
CREATE EMAIL NAME
=========================================================

Parnika Jain
    ->
parnika.jain

Dr. Parnika Kumari Jain
    ->
parnika.jain

Prof. Amit Kumar Singh
    ->
amit.singh
=========================================================
*/
function normalizeNameForEmail(name) {

    const firstLastName =
        getFirstAndLastName(name);


    return firstLastName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");
}


/*
=========================================================
NORMALIZE DEPARTMENT
=========================================================

Computer Science & Engineering
    ->
computerscienceengineering

CSE
    ->
cse
=========================================================
*/
function normalizeDepartment(department) {

    if (!department) {
        return "";
    }

    return department
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "");
}


/*
=========================================================
GENERATE RANDOM PASSWORD
=========================================================

Used ONLY for NEW users.

Existing users keep their existing password.
=========================================================
*/
function generatePassword(length = 10) {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";


    let password = "";


    const randomBytes =
        crypto.randomBytes(length);


    for (let i = 0; i < length; i++) {

        password +=
            characters[
                randomBytes[i] % characters.length
            ];

    }


    return password;
}


/*
=========================================================
GENERATE UNIQUE EMAIL
=========================================================

NORMAL:

Parnika Jain
    ->
parnika.jain@mail.jiit.ac.in


DUPLICATE:

Parnika Jain - CSE
    ->
parnika.jain.cse@mail.jiit.ac.in


IF THAT EXISTS:

parnika.jain.cse1@mail.jiit.ac.in


THEN:

parnika.jain.cse2@mail.jiit.ac.in


currentUserId is ignored during duplicate checking
so an existing user's own email doesn't conflict.
=========================================================
*/
async function generateUniqueEmail(
    name,
    department,
    duplicateName,
    currentUserId = null
) {

    const namePart =
        normalizeNameForEmail(name);


    const departmentPart =
        normalizeDepartment(department);


    let email;


    /*
    ---------------------------------------------
    FIRST EMAIL
    ---------------------------------------------
    */

    if (!duplicateName) {

        email =
            `${namePart}${DOMAIN}`;

    }
    else {

        email =
            `${namePart}.${departmentPart}${DOMAIN}`;

    }


    /*
    ---------------------------------------------
    CHECK EMAIL
    ---------------------------------------------
    */

    let sql = `
        SELECT id
        FROM users
        WHERE email = ?
    `;


    let params = [
        email
    ];


    /*
    Exclude current user's own row
    when updating.
    */

    if (currentUserId !== null) {

        sql += `
            AND id != ?
        `;

        params.push(
            currentUserId
        );

    }


    sql += `
        LIMIT 1
    `;


    const [existing] =
        await db.query(
            sql,
            params
        );


    if (existing.length === 0) {

        return email;

    }


    /*
    ---------------------------------------------
    EMAIL ALREADY EXISTS
    ---------------------------------------------
    */

    let counter = 1;


    while (true) {

        email =
            `${namePart}.${departmentPart}${counter}${DOMAIN}`;


        let numberSql = `
            SELECT id
            FROM users
            WHERE email = ?
        `;


        let numberParams = [
            email
        ];


        if (currentUserId !== null) {

            numberSql += `
                AND id != ?
            `;

            numberParams.push(
                currentUserId
            );

        }


        numberSql += `
            LIMIT 1
        `;


        const [result] =
            await db.query(
                numberSql,
                numberParams
            );


        if (result.length === 0) {

            return email;

        }


        counter++;

    }

}


/*
=========================================================
MAIN MIGRATION
=========================================================
*/
async function migrateFacultyToUsers() {

    console.log(
        "\n======================================="
    );

    console.log(
        " Faculty → Users Migration"
    );

    console.log(
        "=======================================\n"
    );


    try {

        /*
        ---------------------------------------------
        GET ALL FACULTY
        ---------------------------------------------
        */

        const [facultyList] =
            await db.query(
                `
                SELECT
                    id,
                    faculty_id,
                    name,
                    abbreviation,
                    department
                FROM faculty
                ORDER BY id
                `
            );


        console.log(
            `Found ${facultyList.length} faculty members.\n`
        );


        /*
        ---------------------------------------------
        COUNT DUPLICATE FIRST + LAST NAMES
        ---------------------------------------------
        */

        const nameCount = {};


        for (const faculty of facultyList) {

            const normalizedName =
                normalizeNameForEmail(
                    faculty.name
                );


            nameCount[normalizedName] =
                (nameCount[normalizedName] || 0) + 1;

        }


        /*
        ---------------------------------------------
        RESULTS
        ---------------------------------------------
        */

        let inserted = 0;

        let updated = 0;

        let failed = 0;


        /*
        NEW USERS ONLY
        */

        const credentials = [];


        /*
        ---------------------------------------------
        PROCESS EVERY FACULTY
        ---------------------------------------------
        */

        for (const faculty of facultyList) {

            try {

                console.log(
                    `Processing: ${faculty.name} (${faculty.faculty_id})`
                );


                /*
                -----------------------------------------
                EXACT FACULTY NAME
                -----------------------------------------

                This is what will be stored in users.full_name.
                */

                const exactFacultyName =
                    faculty.name;


                /*
                -----------------------------------------
                NAME FOR EMAIL ONLY
                -----------------------------------------
                */

                const emailName =
                    getFirstAndLastName(
                        faculty.name
                    );


                console.log(
                    `  → Exact Faculty Name: ${exactFacultyName}`
                );

                console.log(
                    `  → Email Name: ${emailName}`
                );


                /*
                -----------------------------------------
                NORMALIZED NAME FOR DUPLICATE CHECK
                -----------------------------------------
                */

                const normalizedName =
                    normalizeNameForEmail(
                        faculty.name
                    );


                const duplicateName =
                    nameCount[normalizedName] > 1;


                if (duplicateName) {

                    console.log(
                        `  → Duplicate first+last name detected`
                    );

                }


                /*
                -----------------------------------------
                FIND EXISTING USER
                -----------------------------------------
                */

                const [existingUsers] =
                    await db.query(
                        `
                        SELECT
                            id,
                            full_name,
                            email,
                            password,
                            role,
                            department,
                            can_edit,
                            faculty_id
                        FROM users
                        WHERE faculty_id = ?
                        LIMIT 1
                        `,
                        [
                            faculty.faculty_id
                        ]
                    );


                /*
        =================================================
        EXISTING USER
        =================================================
        */

                if (existingUsers.length > 0) {

                    const existingUser =
                        existingUsers[0];


                    /*
                    -------------------------------------
                    GENERATE CORRECT EMAIL
                    -------------------------------------
                    */

                    const email =
                        await generateUniqueEmail(
                            faculty.name,
                            faculty.department,
                            duplicateName,
                            existingUser.id
                        );


                    /*
                    -------------------------------------
                    UPDATE EXISTING USER
                    -------------------------------------

                    full_name:
                        EXACTLY faculty.name

                    email:
                        NEW generated email

                    password:
                        UNCHANGED

                    role:
                        TEACHER

                    department:
                        FROM faculty table

                    can_edit:
                        0
                    -------------------------------------
                    */

                    await db.query(
                        `
                        UPDATE users
                        SET
                            full_name = ?,
                            email = ?,
                            role = 'TEACHER',
                            department = ?,
                            can_edit = 0
                        WHERE id = ?
                        `,
                        [
                            exactFacultyName,
                            email,
                            faculty.department,
                            existingUser.id
                        ]
                    );


                    updated++;


                    console.log(
                        `  → UPDATED EXISTING USER`
                    );

                    console.log(
                        `  → User ID: ${existingUser.id}`
                    );

                    console.log(
                        `  → Full Name: ${exactFacultyName}`
                    );

                    console.log(
                        `  → Email: ${email}`
                    );

                    console.log(
                        `  → Password: UNCHANGED`
                    );

                    console.log("");

                    continue;

                }


                /*
        =================================================
        NEW USER
        =================================================
        */


                /*
                -----------------------------------------
                GENERATE EMAIL
                -----------------------------------------
                */

                const email =
                    await generateUniqueEmail(
                        faculty.name,
                        faculty.department,
                        duplicateName
                    );


                /*
                -----------------------------------------
                GENERATE TEMPORARY PASSWORD
                -----------------------------------------
                */

                const temporaryPassword =
                    generatePassword();


                /*
                -----------------------------------------
                HASH PASSWORD
                -----------------------------------------
                */

                const hashedPassword =
                    await bcrypt.hash(
                        temporaryPassword,
                        10
                    );


                /*
                -----------------------------------------
                INSERT NEW USER
                -----------------------------------------

                full_name is EXACTLY faculty.name.

                Titles are NOT removed from full_name.
                -----------------------------------------
                */

                await db.query(
                    `
                    INSERT INTO users
                    (
                        full_name,
                        email,
                        password,
                        role,
                        department,
                        can_edit,
                        faculty_id
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        ?,
                        'TEACHER',
                        ?,
                        0,
                        ?
                    )
                    `,
                    [
                        exactFacultyName,
                        email,
                        hashedPassword,
                        faculty.department,
                        faculty.faculty_id
                    ]
                );


                inserted++;


                /*
                -----------------------------------------
                SAVE NEW USER CREDENTIALS
                -----------------------------------------
                */

                credentials.push({

                    faculty_id:
                        faculty.faculty_id,

                    name:
                        exactFacultyName,

                    email:
                        email,

                    temporary_password:
                        temporaryPassword,

                    department:
                        faculty.department,

                    role:
                        "TEACHER",

                    can_edit:
                        0

                });


                console.log(
                    `  → INSERTED NEW USER`
                );

                console.log(
                    `  → Full Name: ${exactFacultyName}`
                );

                console.log(
                    `  → Email: ${email}`
                );

                console.log(
                    `  → Temporary Password: ${temporaryPassword}`
                );

                console.log("");

            }
            catch (facultyError) {

                failed++;


                console.error(
                    `  → FAILED: ${faculty.faculty_id}`
                );

                console.error(
                    `  → ${facultyError.message}`
                );

                console.log("");

            }

        }


        /*
        =================================================
        FINAL RESULT
        =================================================
        */

        console.log(
            "\n======================================="
        );

        console.log(
            " Migration Completed"
        );

        console.log(
            "======================================="
        );

        console.log(
            `Total Faculty : ${facultyList.length}`
        );

        console.log(
            `Inserted      : ${inserted}`
        );

        console.log(
            `Updated       : ${updated}`
        );

        console.log(
            `Failed        : ${failed}`
        );

        console.log(
            "=======================================\n"
        );


        /*
        =================================================
        DISPLAY NEW USER CREDENTIALS
        =================================================
        */

        if (credentials.length > 0) {

            console.log(
                "NEW FACULTY LOGIN CREDENTIALS"
            );

            console.log(
                "=======================================\n"
            );


            console.table(
                credentials
            );


            console.log(
                "\nIMPORTANT:"
            );

            console.log(
                "These passwords are only for newly created users."
            );

            console.log(
                "Existing faculty passwords were NOT changed."
            );

            console.log(
                "Existing faculty full_name values were updated"
            );

            console.log(
                "to exactly match faculty.name."
            );

        }
        else {

            console.log(
                "No new faculty accounts were created."
            );

        }

    }
    catch (error) {

        console.error(
            "\nMigration failed:"
        );

        console.error(
            error
        );

    }
    finally {

        await db.end();

    }

}


/*
=========================================================
RUN MIGRATION
=========================================================
*/

migrateFacultyToUsers();