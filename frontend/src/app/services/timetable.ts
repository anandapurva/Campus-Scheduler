import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  program: string,
  year: number
): Observable<any> {

  const params = new HttpParams()
    .set('program', program)
    .set('year', year.toString());

  return this.http.get(
    `${this.apiUrl}/lunch`,
    { params }
  );

}

}