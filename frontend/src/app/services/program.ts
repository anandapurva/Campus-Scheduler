import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProgramService {

  private apiUrl =
    'http://localhost:5000/api/programs';


  constructor(
    private http: HttpClient
  ) {}


  // ==========================================
  // GET PROGRAMS
  // ==========================================

  getPrograms(): Observable<any[]> {

    return this.http.get<any[]>(
      this.apiUrl
    );

  }


  // ==========================================
  // GET SEMESTERS
  // ==========================================

  getSemesters(
    programId: number
  ): Observable<any[]> {

    return this.http.get<any[]>(
      `${this.apiUrl}/${programId}/semesters`
    );

  }

}