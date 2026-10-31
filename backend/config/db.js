require("dotenv").config();

const mysql = require("mysql2/promise");
console.log("DB CONFIG:");
console.log("HOST:", process.env.DB_HOST);
console.log("PORT:", process.env.DB_PORT);
console.log("USER:", process.env.DB_USER);
console.log("DATABASE:", process.env.DB_NAME);
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(connection => {
        console.log("MySQL Connected Successfully");
        connection.release();
    })
    .catch(err => {
        console.error("MySQL connection failed:");
        console.error(err.message);
    });

module.exports = pool;