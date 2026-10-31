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
export class TeacherEditAccessService {

  private apiUrl =
    'http://localhost:5000/api/teacher-edit-access';

  constructor(
    private http: HttpClient
  ) {}

  getTeachers(): Observable<any> {

    return this.http.get<any>(
      `${this.apiUrl}/teachers`
    );

  }


  grantEditAccess(
    userIds: number[]
  ): Observable<any> {

    return this.http.put<any>(
      `${this.apiUrl}/grant`,
      {
        user_ids: userIds
      }
    );

  }


  revokeEditAccess(
    userId: number
  ): Observable<any> {

    return this.http.put<any>(
      `${this.apiUrl}/revoke`,
      {
        user_id: userId
      }
    );

  }

}