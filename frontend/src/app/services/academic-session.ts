import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AcademicSessionService {

  private apiUrl = 'http://localhost:5000/api/academic-sessions';

  constructor(private http: HttpClient) {}

  getAllSessions(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  getActiveSession(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/active`);
  }

  addSession(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  activateSession(id: number): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/${id}/activate`,
      {}
    );
  }

  deactivateAllSessions(): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/deactivate-all`,
      {}
    );
  }
}