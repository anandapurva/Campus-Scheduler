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
  // GET ACTIVE PROGRAMS
  // ==========================================

  getPrograms(): Observable<any[]> {

    return this.http.get<any[]>(
      this.apiUrl
    );

  }


  // ==========================================
  // GET ALL PROGRAMS
  // ADMIN
  // ==========================================

  getAllPrograms(): Observable<any[]> {

    return this.http.get<any[]>(
      `${this.apiUrl}/all`
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


  // ==========================================
  // CREATE PROGRAM
  // ==========================================

  createProgram(data: {
    program_name: string;
    total_semesters: number;
  }): Observable<any> {

    return this.http.post<any>(
      this.apiUrl,
      data
    );

  }


  // ==========================================
  // UPDATE PROGRAM
  // ==========================================

  updateProgram(
    id: number,
    data: {
      program_name: string;
      total_semesters: number;
    }
  ): Observable<any> {

    return this.http.put<any>(
      `${this.apiUrl}/${id}`,
      data
    );

  }


  // ==========================================
  // ACTIVATE / DEACTIVATE
  // ==========================================

  updateStatus(
    id: number,
    isActive: boolean
  ): Observable<any> {

    return this.http.patch<any>(
      `${this.apiUrl}/${id}/status`,
      {
        is_active: isActive ? 1 : 0
      }
    );

  }

}