import { Injectable, NgZone, OnDestroy } from '@angular/core';

import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class TimetableSocketService implements OnDestroy {

    private socket: Socket;
    constructor(
      private zone: NgZone,

    ) {

    this.socket =
      io(
        'http://localhost:5000'
      );

  }


  // ==================================================
  // JOIN CELL
  // ==================================================

  joinCell(
    academicSessionId: number,
    day: string,
    slotId: number
  ): void {

    this.socket.emit(
      'join-timetable-cell',
      {
        academicSessionId,
        day,
        slotId
      }
    );

  }


  // ==================================================
  // LEAVE CELL
  // ==================================================

  leaveCell(
    academicSessionId: number,
    day: string,
    slotId: number
  ): void {

    this.socket.emit(
      'leave-timetable-cell',
      {
        academicSessionId,
        day,
        slotId
      }
    );

  }


  // ==================================================
  // RESERVE RESOURCE
  // ==================================================

  reserveResource(
    academicSessionId: number,
    day: string,
    slotId: number,
    resourceType: string,
    resourceId: number
  ): void {

    this.socket.emit(
      'reserve-timetable-resource',
      {
        academicSessionId,
        day,
        slotId,
        resourceType,
        resourceId
      }
    );

  }


  // ==================================================
  // RELEASE RESOURCE
  // ==================================================

  releaseResource(
    academicSessionId: number,
    day: string,
    slotId: number,
    resourceType: string,
    resourceId: number
  ): void {

    this.socket.emit(
      'release-timetable-resource',
      {
        academicSessionId,
        day,
        slotId,
        resourceType,
        resourceId
      }
    );

  }


  // ==================================================
  // HEARTBEAT
  // ==================================================

  heartbeat(): void {

    this.socket.emit(
      'timetable-heartbeat'
    );

  }

  // ==================================================
  // USER ACTIVITY
  // ==================================================

  activity(): void {

    this.socket.emit(
      'timetable-activity'
    );

  }


  // ==================================================
  // RESOURCE UPDATE
  // ==================================================

onResourceReservationUpdate(
  callback: (data: any) => void
): () => void {

  const acquiredHandler = (data: any) => {

    this.zone.run(() => {

      callback({
        ...data,
        action: 'reserved'
      });

    });

  };


  const releasedHandler = (data: any) => {

    this.zone.run(() => {

      callback({
        ...data,
        action: 'released'
      });

    });

  };


  this.socket.on(
    'temporary-resource-lock-acquired',
    acquiredHandler
  );

  this.socket.on(
    'temporary-resource-lock-released',
    releasedHandler
  );


  return () => {

    this.socket.off(
      'temporary-resource-lock-acquired',
      acquiredHandler
    );

    this.socket.off(
      'temporary-resource-lock-released',
      releasedHandler
    );

  };

}


  // ==================================================
  // SNAPSHOT
  // ==================================================

onResourceReservationSnapshot(
  callback: (data: any) => void
): void {

  this.socket.on(
    'temporary-resource-locks',
    (reservations: any[]) => {

      this.zone.run(() => {

        callback({
          reservations:
            Array.isArray(reservations)
              ? reservations
              : []
        });

      });

    }
  );

}


  // ==================================================
  // REJECTED
  // ==================================================

onResourceReservationRejected(
  callback: (data: any) => void
): void {

  this.socket.on(
    'resource-reservation-denied',
    (data: any) => {

      this.zone.run(() => {

        callback({
          ...data,
          message:
            'This resource is already being used by another coordinator.'
        });

      });

    }
  );

}

getSocketId(): string | undefined {
  return this.socket.id;
}


  // ==================================================
  // DESTROY
  // ==================================================

  ngOnDestroy(): void {

    this.socket.disconnect();

  }

}