// ======================================================
// TIMETABLE SOCKET
// TEMPORARY RESOURCE RESERVATIONS
// ======================================================

const reservations = new Map();

const RESERVATION_TIMEOUT = 60 * 1000;


// ======================================================
// ROOM
// ======================================================

function getTimetableCellRoom(
    academicSessionId,
    day,
    slotId
) {
    return `timetable:${academicSessionId}:${day}:${slotId}`;
}


// ======================================================
// RESERVATION KEY
// ======================================================

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
    ].join(':');

}


// ======================================================
// CHECK EXPIRED RESERVATION
// ======================================================

function isExpired(reservation) {

    return (
        Date.now() - reservation.lastActivity
        >= RESERVATION_TIMEOUT
    );

}


// ======================================================
// CLEAN EXPIRED RESERVATIONS
// ======================================================

function cleanupExpiredReservations(io) {

    const now = Date.now();

    for (
        const [key, reservation]
        of reservations.entries()
    ) {

        if (
            now - reservation.lastActivity
            >= RESERVATION_TIMEOUT
        ) {

            reservations.delete(key);


            const room =
                getTimetableCellRoom(
                    reservation.academicSessionId,
                    reservation.day,
                    reservation.slotId
                );


            io.to(room).emit(
                'resource-reservation-updated',
                {
                    action: 'released',

                    resourceType:
                        reservation.resourceType,

                    resourceId:
                        reservation.resourceId
                }
            );


            console.log(
                'Reservation expired:',
                key
            );

        }

    }

}


// ======================================================
// GET ACTIVE RESERVATIONS FOR CELL
// ======================================================

function getReservationsForCell(
    academicSessionId,
    day,
    slotId
) {

    const result = [];

    for (
        const reservation
        of reservations.values()
    ) {

        if (
            Number(
                reservation.academicSessionId
            ) === Number(academicSessionId)

            && reservation.day === day

            && Number(
                reservation.slotId
            ) === Number(slotId)

            && !isExpired(reservation)
        ) {

            result.push({

                resourceType:
                    reservation.resourceType,

                resourceId:
                    Number(
                        reservation.resourceId
                    )

            });

        }

    }

    return result;

}


// ======================================================
// SOCKET INITIALIZATION
// ======================================================

module.exports = function(io) {


    // ==================================================
    // CLEANUP TIMER
    // ==================================================

    setInterval(() => {

        cleanupExpiredReservations(io);

    }, 5000);


    // ==================================================
    // CONNECTION
    // ==================================================

    io.on('connection', (socket) => {

        console.log(
            'Socket connected:',
            socket.id
        );


        // ==================================================
        // JOIN CELL
        // ==================================================

        socket.on(
            'join-timetable-cell',
            ({
                academicSessionId,
                day,
                slotId
            }) => {

                const room =
                    getTimetableCellRoom(
                        academicSessionId,
                        day,
                        slotId
                    );


                socket.join(room);


                console.log(
                    `Socket ${socket.id} joined ${room}`
                );


                // ------------------------------------------
                // SEND CURRENT TEMPORARY RESERVATIONS
                // ------------------------------------------

                const activeReservations =
                    getReservationsForCell(
                        academicSessionId,
                        day,
                        slotId
                    );


                socket.emit(
                    'resource-reservation-snapshot',
                    {
                        academicSessionId,
                        day,
                        slotId,
                        reservations:
                            activeReservations
                    }
                );

            }
        );


        // ==================================================
        // LEAVE CELL
        // ==================================================

        socket.on(
            'leave-timetable-cell',
            ({
                academicSessionId,
                day,
                slotId
            }) => {

                const room =
                    getTimetableCellRoom(
                        academicSessionId,
                        day,
                        slotId
                    );


                socket.leave(room);

            }
        );


        // ==================================================
        // RESERVE RESOURCE
        // ==================================================

        socket.on(
            'reserve-timetable-resource',
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
                    !resourceId
                ) {

                    return;

                }


                const key =
                    getReservationKey(
                        academicSessionId,
                        day,
                        slotId,
                        resourceType,
                        resourceId
                    );


                const existing =
                    reservations.get(key);


                // ------------------------------------------
                // EXISTING ACTIVE RESERVATION
                // ------------------------------------------

                if (
                    existing &&
                    !isExpired(existing) &&
                    existing.socketId !== socket.id
                ) {

                    socket.emit(
                        'resource-reservation-rejected',
                        {
                            resourceType,
                            resourceId,
                            message:
                                'Resource is already being used by another coordinator.'
                        }
                    );

                    return;

                }


                // ------------------------------------------
                // CREATE / REFRESH RESERVATION
                // ------------------------------------------

                reservations.set(
                    key,
                    {
                        socketId:
                            socket.id,

                        academicSessionId:
                            Number(
                                academicSessionId
                            ),

                        day,

                        slotId:
                            Number(slotId),

                        resourceType,

                        resourceId:
                            Number(resourceId),

                        lastActivity:
                            Date.now()
                    }
                );


                const room =
                    getTimetableCellRoom(
                        academicSessionId,
                        day,
                        slotId
                    );


                // ------------------------------------------
                // SEND TO OTHER COORDINATORS
                // ------------------------------------------

                socket.to(room).emit(
                    'resource-reservation-updated',
                    {
                        action: 'reserved',

                        resourceType,

                        resourceId:
                            Number(resourceId)
                    }
                );


                console.log(
                    'Resource reserved:',
                    key,
                    'by',
                    socket.id
                );

            }
        );


        // ==================================================
        // RELEASE RESOURCE
        // ==================================================

        socket.on(
            'release-timetable-resource',
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
                    reservations.get(key);


                // Only owner can release
                if (
                    !reservation ||
                    reservation.socketId !== socket.id
                ) {

                    return;

                }


                reservations.delete(key);


                const room =
                    getTimetableCellRoom(
                        academicSessionId,
                        day,
                        slotId
                    );


                socket.to(room).emit(
                    'resource-reservation-updated',
                    {
                        action: 'released',

                        resourceType,

                        resourceId:
                            Number(resourceId)
                    }
                );


                console.log(
                    'Resource released:',
                    key
                );

            }
        );


        // ==================================================
        // HEARTBEAT
        // ==================================================

        socket.on(
            'timetable-heartbeat',
            () => {

                for (
                    const reservation
                    of reservations.values()
                ) {

                    if (
                        reservation.socketId ===
                        socket.id
                    ) {

                        reservation.lastActivity =
                            Date.now();

                    }

                }

            }
        );


        // ==================================================
        // RELEASE ALL ON DISCONNECT
        // ==================================================

        socket.on(
            'disconnect',
            () => {

                console.log(
                    'Socket disconnected:',
                    socket.id
                );


                for (
                    const [
                        key,
                        reservation
                    ]
                    of reservations.entries()
                ) {

                    if (
                        reservation.socketId ===
                        socket.id
                    ) {

                        reservations.delete(key);


                        const room =
                            getTimetableCellRoom(
                                reservation.academicSessionId,
                                reservation.day,
                                reservation.slotId
                            );


                        socket.to(room).emit(
                            'resource-reservation-updated',
                            {
                                action: 'released',

                                resourceType:
                                    reservation.resourceType,

                                resourceId:
                                    Number(
                                        reservation.resourceId
                                    )
                            }
                        );

                    }

                }

            }
        );

    });

};