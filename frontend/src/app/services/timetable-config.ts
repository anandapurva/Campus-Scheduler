import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class TimetableConfigService {

  private apiUrl =
    'http://localhost:5000/api/timetable-config';


  constructor(
    private http: HttpClient
  ) {}


  // ==========================================================
  // LOCK LUNCH
  // ==========================================================

  lockLunch(data: {
    program: string;
    year: number;
    lunchStart: string;
    lunchEnd: string;
    facultyId: string;
  }): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/lock-lunch`,
      data
    );

  }


  // ==========================================================
  // GET LUNCH CONFIGURATION
  // ==========================================================

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

updateLunchConfiguration(data: any) {
  return this.http.put(
    `${this.apiUrl}/lunch`,
    data
  );
}

// ============================================================
// CHANGE LUNCH
// ============================================================

changeLunch(request: {
  program: string;
  year: number;
  lunchStart: string;
  lunchEnd: string;
  facultyId: string;
}): Observable<any> {

  return this.http.put(
    `${this.apiUrl}/lunch/change`,
    request
  );

}


  // ==========================================================
  // GET ALL
  // ==========================================================

  getAllLunchConfigurations(): Observable<any> {

    return this.http.get(
      `${this.apiUrl}/lunch/all`
    );

  }

}