import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TimetableConfigService } from './timetable-config';
import { TimeSlot } from '../pages/faculty/timetable/timetable';
@Injectable({
  providedIn: 'root'
})
export class TimetableService {

  private apiUrl =
    'http://localhost:5000/api/timetable';


  constructor(
    private http: HttpClient,
    private timetableConfigService: TimetableConfigService
  ) {}


  // ==================================================
  // LOCK LUNCH
  // ==================================================

  lockLunch(data: any): Observable<any> {

    return this.timetableConfigService.lockLunch(data);
  }


  // ==================================================
  // GET LUNCH CONFIGURATION
  // ==================================================

  getLunchConfiguration(
    program: string,
    year: number
  ): Observable<any> {

    return this.timetableConfigService.getLunchConfiguration(
      program,
      year
    );
  }


  // ==================================================
  // CHANGE LUNCH
  // ==================================================

  changeLunch(data: {
    program: string;
    year: number;
    lunchStart: string;
    lunchEnd: string;
    facultyId: string;
  }): Observable<any> {

    return this.timetableConfigService.changeLunch(data);
  }


  // ==================================================
  // CREATE TIMETABLE ENTRY
  // ==================================================

  createTimetableEntry(
    data: any
  ): Observable<any> {

    return this.http.post(
      this.apiUrl,
      data
    );
  }


  // ==================================================
  // GET TIMETABLE
  // ==================================================

  getTimetable(
    academicSessionId: number,
    programId: number,
    departmentId: number,
    semesterId: number
  ): Observable<any> {

    return this.http.get(
      `${this.apiUrl}`,
      {
        params: {
          academicSessionId:
            academicSessionId.toString(),

          programId:
            programId.toString(),

          departmentId:
            departmentId.toString(),

          semesterId:
            semesterId.toString()
        }
      }
    );

  }

  getLockedResources(
    academicSessionId: number,
    day: string,
    slotId: number,
    excludeEntryId?: number
  ) {

    let params: any = {
      academicSessionId,
      day,
      slotId
    };

    if (excludeEntryId) {
      params.excludeEntryId = excludeEntryId;
    }

    return this.http.get<any>(
      `${this.apiUrl}/locked-resources`,
      {
        params
      }
    );
  }

  getTimetableStatus(
  academicSessionId: number,
  programId: number,
  departmentId: number,
  semesterId: number
) {
  return this.http.get<any>(
    `${this.apiUrl}/status`,
    {
      params: {
        academicSessionId,
        programId,
        departmentId,
        semesterId
      }
    }
  );
}

finalizeTimetable(data: {
  academicSessionId: number;
  programId: number;
  departmentId: number;
  semesterId: number;
  userId?: number;
}) {
  return this.http.post<any>(
    `${this.apiUrl}/finalize`,
    data
  );
}

unfinalizeTimetable(data: {
  academicSessionId: number;
  programId: number;
  departmentId: number;
  semesterId: number;
}) {
  return this.http.post<any>(
    `${this.apiUrl}/unfinalize`,
    data
  );
}

getSubjectHours(
  batchId: number,
  subjectId: number,
  academicSessionId: number
) {
  return this.http.get<any>(
    `${this.apiUrl}/hours`,
    {
      params: {
        batchId,
        subjectId,
        academicSessionId
      }
    }
  );
}

checkPracticalAvailability(payload: {
  academicSessionId: number;
  day: string;
  firstSlotId: number;
  secondSlotId: number;
  batchIds: number[];
  teacherIds: number[];
  roomId: number;
}) {
  return this.http.post<any>(
    `${this.apiUrl}/practical-availability`,
    payload
  );
}


getNextSlot(
  selectedCell: any,
  timeSlots: TimeSlot[]
): TimeSlot | null {

  if (!selectedCell?.slot || !timeSlots?.length) {
    return null;
  }

  const currentIndex = timeSlots.findIndex(
    slot => Number(slot.id) === Number(selectedCell.slot.id)
  );

  if (
    currentIndex === -1 ||
    currentIndex >= timeSlots.length - 1
  ) {
    return null;
  }

  return timeSlots[currentIndex + 1];
}
}