const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

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
        WHERE email = ?
    `;

    db.query(sql, [email], async (err, result) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                message: "Database error"
            });
        }

        if (result.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                department: user.department,
                can_edit: user.can_edit
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        delete user.password;

        res.json({
            message: "Login Successful",
            token: token,
            user: user
        });

    });
};