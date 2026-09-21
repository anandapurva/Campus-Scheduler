import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TimetableConfigService } from './timetable-config';

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

}