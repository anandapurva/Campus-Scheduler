import { Injectable } from '@angular/core';
import {
  HttpClient
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class SubjectService {

  private apiUrl =
    'http://localhost:5000/api/subjects';


  constructor(
    private http: HttpClient
  ) {}


  // ==========================================
  // PREVIEW CSV
  // ==========================================

  previewCSV(
    file: File
  ): Observable<any> {

    const formData =
      new FormData();

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
  // IMPORT
  // ==========================================

  importSubjects(
    data: any[],
    program: string,
    department: string,
    semester: number
  ): Observable<any> {

    return this.http.post(

      `${this.apiUrl}/import`,

      {
        data,
        program,
        department,
        semester
      }

    );

  }


  // ==========================================
  // GET SUBJECTS
  // ==========================================

  getSubjects(
    program: string,
    department: string,
    semester: number
  ): Observable<any[]> {

    return this.http.get<any[]>(
      `${this.apiUrl}`,
      {
        params: {

          program,

          department,

          semester:
            semester.toString()

        }
      }
    );

  }

    // ==========================================
  // ADD SUBJECT
  // ==========================================

  addSubject(
    subject: any
  ): Observable<any> {

    return this.http.post(
      this.apiUrl,
      subject
    );

  }


  // ==========================================
  // UPDATE SUBJECT
  // ==========================================

  updateSubject(
    id: number,
    subject: any
  ): Observable<any> {

    return this.http.put(
      `${this.apiUrl}/${id}`,
      subject
    );

  }


  // ==========================================
  // DELETE SUBJECT
  // ==========================================

  deleteSubject(
    id: number
  ): Observable<any> {

    return this.http.delete(
      `${this.apiUrl}/${id}`
    );

  }

}