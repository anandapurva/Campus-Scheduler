require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// ======================================================
// HTTP SERVER
// ======================================================

const server = http.createServer(app);

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST", "PUT", "DELETE"],
    },
});

app.set("io", io);

// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on("connection", (socket) => {

    console.log(
        "Socket connected:",
        socket.id
    );

    // --------------------------------------------------
    // JOIN TIMETABLE CELL
    // --------------------------------------------------

    socket.on("join-timetable-cell", (room) => {

        socket.join(room);

        console.log(
            `Socket ${socket.id} joined ${room}`
        );

    });

    // --------------------------------------------------
    // LEAVE TIMETABLE CELL
    // --------------------------------------------------

    socket.on("leave-timetable-cell", (room) => {

        socket.leave(room);

        console.log(
            `Socket ${socket.id} left ${room}`
        );

    });

    // --------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------

    socket.on("disconnect", () => {

        console.log(
            "Socket disconnected:",
            socket.id
        );

    });

});

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    cors({
        origin: "http://localhost:4200",
        methods: ["GET", "POST", "PUT", "DELETE"],
    })
);

app.use(express.json());

const authRoutes = require("./routes/auth.routes");
const facultyRoutes = require("./routes/faculty.routes");
const timetableConfigRoutes = require("./routes/timetableConfig.routes");
const programRoutes = require("./routes/program.routes");
const roomRoutes = require("./routes/room.route");
const departmentRoutes = require("./routes/department.route");
const subjectRoutes = require("./routes/subject.routes");
const dashboardRoutes = require('./routes/dashboard.route');
const batchRoutes = require('./routes/batch.routes');
const academicSessionRoutes = require('./routes/academicSessionRoutes');
const timetableRoutes = require('./routes/timetable.route');
const queryRoutes = require('./routes/query.routes');
const teacherEditAccessRoutes = require("./routes/teacher-edit-access.routes");

app.use('/api/academic-sessions', academicSessionRoutes);
app.use('/api/batches', batchRoutes);
app.use( "/api/auth", authRoutes );
app.use( '/api/dashboard', dashboardRoutes );
app.use( "/api/faculty", facultyRoutes );
app.use( "/api/timetable-config", timetableConfigRoutes );
app.use( '/api/programs', programRoutes );
app.use( "/api/rooms", roomRoutes );
app.use( "/api/departments", departmentRoutes );
app.use( "/api/subjects", subjectRoutes );
app.use( '/api/timetable', timetableRoutes );
app.use('/api/query', queryRoutes);
app.use("/api/teacher-edit-access", teacherEditAccessRoutes);

app.listen(process.env.PORT, ()=>{
    console.log(`Server running on port ${process.env.PORT}`);
});

