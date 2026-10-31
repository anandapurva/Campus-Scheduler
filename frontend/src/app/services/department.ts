import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class DepartmentService {

  private apiUrl =
    'http://localhost:5000/api/departments';


  constructor(
    private http: HttpClient
  ) {}


  // ==========================================
  // ACTIVE DEPARTMENTS FOR PROGRAM
  // ==========================================

  getDepartmentsByProgram(
  programId: number | string
): Observable<any[]> {

  return this.http.get<any[]>(
    `${this.apiUrl}/by-program`,
    {
      params: {
        programId: String(programId)
      }
    }
  );

}


  // ==========================================
  // ALL DEPARTMENTS
  // ADMIN
  // ==========================================

  getDepartments(): Observable<any[]> {

    return this.http.get<any[]>(
      this.apiUrl
    );

  }


  // ==========================================
  // CREATE
  // ==========================================

  createDepartment(data: {
    name: string;
    abbreviation: string;
    programIds: number[];
  }): Observable<any> {

    return this.http.post<any>(
      this.apiUrl,
      data
    );

  }


  // ==========================================
  // UPDATE
  // ==========================================

  updateDepartment(
    id: number,
    data: {
      name: string;
      abbreviation: string;
      programIds: number[];
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

  getProgramsByDepartment(
  departmentId: number
): Observable<any[]> {

  return this.http.get<any[]>(
    `${this.apiUrl}/${departmentId}/programs`
  );

}



}