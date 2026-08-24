import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FacultyService {

  private apiUrl =
    'http://localhost:5000/api/faculty';


  constructor(
    private http: HttpClient
  ) {}


  // ==========================================
  // CSV PREVIEW
  // ==========================================

  previewCSV(file: File): Observable<any> {

    const formData = new FormData();

    formData.append(
      'file',
      file
    );

    return this.http.post(
      `${this.apiUrl}/preview`,
      formData
    );

  }


  // ==========================================
  // CSV IMPORT
  // ==========================================

  importFaculty(
    data: any[]
  ): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/import`,
      {
        data
      }
    );

  }


  // ==========================================
  // GET FACULTY
  // ==========================================

  getFaculty(): Observable<any[]> {

    return this.http.get<any[]>(
      this.apiUrl
    );

  }


  // ==========================================
  // CREATE FACULTY
  // ==========================================

  createFaculty(
    faculty: any
  ): Observable<any> {

    return this.http.post(
      this.apiUrl,
      faculty
    );

  }


  // ==========================================
  // UPDATE FACULTY
  // ==========================================

  updateFaculty(
    facultyId: string,
    faculty: any
  ): Observable<any> {

    return this.http.put(
      `${this.apiUrl}/${facultyId}`,
      faculty
    );

  }


  // ==========================================
  // DELETE FACULTY
  // ==========================================

  deleteFaculty(
    facultyId: string
  ): Observable<any> {

    return this.http.delete(
      `${this.apiUrl}/${facultyId}`
    );

  }

}