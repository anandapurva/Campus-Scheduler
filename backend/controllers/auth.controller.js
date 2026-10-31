
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {

    try {

        const { faculty_id, password } = req.body;

        // ==========================================
        // CHECK INPUT
        // ==========================================

        if (!faculty_id || !password) {

            return res.status(400).json({
                message: "Faculty ID and password are required"
            });

        }

        // ==========================================
        // FIND ADMIN OR TEACHER BY FACULTY ID
        // ==========================================

        const sql = `
            SELECT
                id,
                full_name,
                email,
                password,
                role,
                faculty_id,
                department,
                can_edit
            FROM users
            WHERE faculty_id = ?
              AND role IN ('ADMIN', 'TEACHER')
        `;

        const [result] = await db.query(
            sql,
            [faculty_id.trim()]
        );

        // ==========================================
        // FACULTY NOT FOUND
        // ==========================================

        if (result.length === 0) {

            return res.status(401).json({
                message: "Invalid Faculty ID or password"
            });

        }

        const user = result[0];
       

        // ==========================================
        // CHECK PASSWORD
        // ==========================================

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatch) {

            return res.status(401).json({
                message: "Invalid Faculty ID or password"
            });

        }

        // ==========================================
        // CHECK JWT SECRET
        // ==========================================

        if (!process.env.JWT_SECRET) {

            console.error(
                "JWT_SECRET is missing from .env"
            );

            return res.status(500).json({
                message: "Server configuration error"
            });

        }

        // ==========================================
        // CREATE JWT
        // ==========================================

        const token = jwt.sign(

            {
                id: user.id,
                faculty_id: user.faculty_id,
                role: user.role,
                department: user.department,
                can_edit: user.can_edit
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "1d"
            }

        );

        // ==========================================
        // REMOVE PASSWORD
        // ==========================================

        delete user.password;

        // ==========================================
        // SEND RESPONSE
        // ==========================================

        return res.json({

            message: "Login Successful",

            token: token,

            user: user

        });

    }

    catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        return res.status(500).json({

            message: "Server error during login"

        });

    }

};

