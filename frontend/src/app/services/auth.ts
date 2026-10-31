import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = 'http://localhost:5000/api/auth';

  constructor(
    private http: HttpClient
  ) {}

  // LOGIN
  login(
  faculty_id: string,
  password: string
): Observable<any> {

  return this.http.post<any>(
    `${this.apiUrl}/login`,
    {
      faculty_id: faculty_id,
      password: password
    }
  );

}

  // SAVE USER
  saveUser(user: any): void {

    localStorage.setItem(
      'user',
      JSON.stringify(user)
    );

  }

  // GET USER
  getUser(): any {

    const user =
      localStorage.getItem('user');

    if (!user) {
      return null;
    }

    try {

      return JSON.parse(user);

    } catch {

      return null;

    }

  }

  // LOGOUT
  // ==========================================

logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('role');

  sessionStorage.clear();
  window.location.href = '/login';
}

  // CHECK LOGIN
  isLoggedIn(): boolean {

    return !!localStorage.getItem('user');

  }

}