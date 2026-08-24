require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/auth.routes");
const facultyRoutes = require("./routes/faculty.routes");
const timetableConfigRoutes = require("./routes/timetableConfig.routes");
const programRoutes = require('./routes/program.routes');
const roomRoutes = require("./routes/room.route");
const departmentRoutes = require("./routes/department.route");
const subjectRoutes = require("./routes/subject.routes");
const dashboardRoutes = require('./routes/dashboard.route');

app.use( "/api/auth", authRoutes );
app.use( '/api/dashboard', dashboardRoutes );
app.use( "/api/faculty", facultyRoutes );
app.use( "/api/timetable-config", timetableConfigRoutes );
app.use( '/api/programs', programRoutes );
app.use( "/api/rooms", roomRoutes );
app.use( "/api/departments", departmentRoutes );
app.use( "/api/subjects", subjectRoutes );

app.listen(process.env.PORT, ()=>{
    console.log(`Server running on port ${process.env.PORT}`);
});

