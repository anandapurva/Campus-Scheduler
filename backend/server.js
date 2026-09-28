require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());


// ============================================================
// ROUTES
// ============================================================

const authRoutes = require("./routes/auth.routes");
const facultyRoutes = require("./routes/faculty.routes");
const timetableConfigRoutes = require("./routes/timetableConfig.routes");
const programRoutes = require("./routes/program.routes");
const roomRoutes = require("./routes/room.route");
const departmentRoutes = require("./routes/department.route");
const subjectRoutes = require("./routes/subject.routes");
const dashboardRoutes = require("./routes/dashboard.route");
const batchRoutes = require("./routes/batch.routes");
const academicSessionRoutes = require("./routes/academicSessionRoutes");
const timetableRoutes = require("./routes/timetable.route");
const queryRoutes = require("./routes/query.routes");
const teacherEditAccessRoutes = require("./routes/teacher-edit-access.routes");


// ============================================================
// API ROUTES
// ============================================================

app.use("/api/academic-sessions", academicSessionRoutes);

app.use("/api/batches", batchRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/faculty", facultyRoutes);

app.use("/api/timetable-config", timetableConfigRoutes);

app.use("/api/programs", programRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api/departments", departmentRoutes);

app.use("/api/subjects", subjectRoutes);

app.use("/api/timetable", timetableRoutes);

app.use("/api/query", queryRoutes);

app.use(
    "/api/teacher-edit-access",
    teacherEditAccessRoutes
);


// ============================================================
// TEST ROUTE
// ============================================================

app.get("/", (req, res) => {
    res.json({
        message: "Campus Scheduler API is running"
    });
});


// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );

});