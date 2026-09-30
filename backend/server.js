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
// TEMPORARY TIMETABLE RESOURCE RESERVATIONS
// ======================================================

// reservationKey -> reservation
const timetableReservations = new Map();

const RESERVATION_TIMEOUT = 60 * 1000;

// ======================================================
// COORDINATOR ACTIVITY
// ======================================================

const coordinatorActivity = new Map();

const INACTIVITY_TIMEOUT = 60 * 1000;


// ------------------------------------------------------
// RESOURCE KEY
// ------------------------------------------------------

function getReservationKey(
    academicSessionId,
    day,
    slotId,
    resourceType,
    resourceId
) {
    return [
        academicSessionId,
        day,
        slotId,
        resourceType,
        resourceId
    ].join(":");
}


// ------------------------------------------------------
// REMOVE EXPIRED RESERVATION
// ------------------------------------------------------

function removeReservation(key) {

    const reservation =
        timetableReservations.get(key);

    if (!reservation) {
        return;
    }

    clearTimeout(reservation.timer);

    timetableReservations.delete(key);

    io.to(reservation.roomName).emit(
        "temporary-resource-lock-released",
        {
            resourceType:
                reservation.resourceType,

            resourceId:
                reservation.resourceId
        }
    );

    console.log(
        "Temporary reservation expired:",
        key
    );
}

    function markCoordinatorActivity(socketId) {

        coordinatorActivity.set(
            socketId,
            Date.now()
        );

    }


    // ======================================================
// INACTIVITY CHECKER
// ======================================================

setInterval(() => {

    const now = Date.now();

    for (
        const [
            socketId,
            lastActivity
        ]
        of coordinatorActivity
    ) {

        if (
            now - lastActivity <
            INACTIVITY_TIMEOUT
        ) {

            continue;

        }

        console.log(
            "Coordinator inactive for 60 seconds:",
            socketId
        );

        // ------------------------------------------
        // RELEASE ALL RESOURCES OF THIS COORDINATOR
        // ------------------------------------------

        for (
            const [
                key,
                reservation
            ]
            of timetableReservations
        ) {

            if (
                reservation.socketId !==
                socketId
            ) {

                continue;

            }

            clearTimeout(
                reservation.timer
            );

            timetableReservations.delete(
                key
            );

            io.to(
                reservation.roomName
            ).emit(
                "temporary-resource-lock-released",
                {
                    resourceType:
                        reservation.resourceType,

                    resourceId:
                        reservation.resourceId
                }
            );

            console.log(
                "Released inactive resource:",
                key
            );

        }

        coordinatorActivity.delete(
            socketId
        );

    }

}, 5000);
// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on("connection", (socket) => {

    console.log(
        "Socket connected:",
        socket.id
    );


    // ==================================================
    // JOIN TIMETABLE CELL
    // ==================================================

    socket.on(
        "join-timetable-cell",
        (data) => {

            const {
                academicSessionId,
                day,
                slotId
            } = data;

            if (
                !academicSessionId ||
                !day ||
                !slotId
            ) {
                return;
            }

            const roomName =
                `timetable:${academicSessionId}:${day}:${slotId}`;

            socket.join(roomName);

            console.log(
                `Socket ${socket.id} joined ${roomName}`
            );

            const currentReservations = [];

            for (
                const reservation
                of timetableReservations.values()
            ) {

                if (
                    reservation.roomName === roomName
                ) {

                    currentReservations.push({

                        resourceType:
                            reservation.resourceType,

                        resourceId:
                            reservation.resourceId

                    });

                }

            }

            socket.emit(
                "temporary-resource-locks",
                currentReservations
            );
        }
    );


    // ==================================================
    // RESERVE RESOURCE
    // ==================================================

    socket.on(
        "reserve-timetable-resource",
        (data) => {

            const {
                academicSessionId,
                day,
                slotId,
                resourceType,
                resourceId
            } = data;


            if (
                !academicSessionId ||
                !day ||
                !slotId ||
                !resourceType ||
                resourceId === undefined ||
                resourceId === null
            ) {

                return;

            }

            markCoordinatorActivity(socket.id);
            const roomName =
                `timetable:${academicSessionId}:${day}:${slotId}`;


            const key =
                getReservationKey(
                    academicSessionId,
                    day,
                    slotId,
                    resourceType,
                    resourceId
                );


            // ------------------------------------------
            // ALREADY RESERVED
            // ------------------------------------------

            const existing =
                timetableReservations.get(key);


            if (
                existing &&
                existing.socketId !== socket.id
            ) {

                socket.emit(
                    "resource-reservation-denied",
                    {
                        resourceType,
                        resourceId
                    }
                );

                return;

            }


            // ------------------------------------------
            // RENEW EXISTING RESERVATION
            // ------------------------------------------

            if (existing) {

                clearTimeout(
                    existing.timer
                );

            }


            // ------------------------------------------
            // CREATE / RENEW RESERVATION
            // ------------------------------------------

            const timer =
                setTimeout(
                    () => {

                        removeReservation(
                            key
                        );

                    },
                    RESERVATION_TIMEOUT
                );


            timetableReservations.set(
                key,
                {
                    socketId:
                        socket.id,

                    roomName,

                    resourceType,

                    resourceId:

                        Number(resourceId),

                    timer,

                    createdAt:
                        Date.now(),
                    lastActivityAt: Date.now()
                }
            );


            // ------------------------------------------
            // BROADCAST
            // ------------------------------------------

            socket.to(roomName).emit(
                "temporary-resource-lock-acquired",
                {
                    resourceType,

                    resourceId:
                        Number(resourceId),

                    socketId:
                        socket.id
                }
            );


            console.log(
                "Temporary resource reserved:",
                {
                    key,
                    socketId:
                        socket.id
                }
            );

        }
    );


    // ==================================================
    // RELEASE RESOURCE
    // ==================================================

    socket.on(
        "release-timetable-resource",
        (data) => {

            const {
                academicSessionId,
                day,
                slotId,
                resourceType,
                resourceId
            } = data;


            const key =
                getReservationKey(
                    academicSessionId,
                    day,
                    slotId,
                    resourceType,
                    resourceId
                );


            const reservation =
                timetableReservations.get(key);


            // Only owner can release it
            if (
                !reservation ||
                reservation.socketId !== socket.id
            ) {

                return;

            }


            clearTimeout(
                reservation.timer
            );


            timetableReservations.delete(
                key
            );


            io.to(
                reservation.roomName
            ).emit(
                "temporary-resource-lock-released",
                {
                    resourceType,

                    resourceId:
                        Number(resourceId)
                }
            );


            console.log(
                "Temporary resource released:",
                key
            );

        }
    );


    // ==================================================
    // RELEASE ALL RESOURCES OWNED BY SOCKET
    // ==================================================

    socket.on(
        "release-all-timetable-resources",
        () => {

            for (
                const [
                    key,
                    reservation
                ]
                of timetableReservations
            ) {

                if (
                    reservation.socketId !==
                    socket.id
                ) {

                    continue;

                }


                clearTimeout(
                    reservation.timer
                );


                timetableReservations.delete(
                    key
                );


                io.to(
                    reservation.roomName
                ).emit(
                    "temporary-resource-lock-released",
                    {
                        resourceType:
                            reservation.resourceType,

                        resourceId:
                            reservation.resourceId
                    }
                );

            }

        }
    );


    // ==================================================
    // DISCONNECT
    // ==================================================

    socket.on(
        "disconnect",
        () => {

            console.log(
                "Socket disconnected:",
                socket.id
            );


            // Release all temporary locks
            // owned by this coordinator

            for (
                const [
                    key,
                    reservation
                ]
                of timetableReservations
            ) {

                if (
                    reservation.socketId !==
                    socket.id
                ) {

                    continue;

                }


                clearTimeout(
                    reservation.timer
                );


                timetableReservations.delete(
                    key
                );


                io.to(
                    reservation.roomName
                ).emit(
                    "temporary-resource-lock-released",
                    {
                        resourceType:
                            reservation.resourceType,

                        resourceId:
                            reservation.resourceId
                    }
                );

            }

            coordinatorActivity.delete(
                socket.id
            );

        }
    );

    socket.on(
        "timetable-heartbeat",
        () => {}
    );

    // ==================================================
// USER ACTIVITY
// ==================================================

    socket.on(
        "timetable-activity",
        () => {

            markCoordinatorActivity(
                socket.id
            );

        }
    );

    socket.on(
        "leave-timetable-cell",
        (data) => {

            const {
                academicSessionId,
                day,
                slotId
            } = data;

            if (
                !academicSessionId ||
                !day ||
                !slotId
            ) {
                return;
            }

            const roomName =
                `timetable:${academicSessionId}:${day}:${slotId}`;

            socket.leave(roomName);

            console.log(
                `Socket ${socket.id} left ${roomName}`
            );

        }
    );

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

server.listen(process.env.PORT, ()=>{
    console.log(`Server running on port ${process.env.PORT}`);
});

