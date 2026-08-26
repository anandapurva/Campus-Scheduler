import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimetableService {

  private apiUrl =
    'http://localhost:5000/api/timetable-config';


  constructor(
    private http: HttpClient
  ) {}


  // ==================================================
  // LOCK LUNCH
  // ==================================================

  // lockLunch(data: any): Observable<any> {

  //   return this.http.post(
  //     `${this.apiUrl}/lock-lunch`,
  //     data
  //   );

  // }

  lockLunch(data: any): Observable<any> {

  console.log('LOCK LUNCH SERVICE CALLED');
  console.log('API URL:', `${this.apiUrl}/lock-lunch`);
  console.log('DATA:', data);

  return this.http.post(
    `${this.apiUrl}/lock-lunch`,
    data
  );

}


  // ==================================================
  // GET LUNCH
  // ==================================================

  getLunchConfiguration(
    department: string,
    program: string,
    semester: number
  ): Observable<any> {

    return this.http.get(

      `${this.apiUrl}/lunch`,

      {
        params: {

          department,
          program,
          semester:
            semester.toString()

        }

      }

    );

  }

}