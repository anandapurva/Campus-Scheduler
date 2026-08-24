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


  // ==========================================
  // LOGIN
  // ==========================================

  login(
    email: string,
    password: string
  ): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/login`,
      {
        email,
        password
      }
    );

  }


  // ==========================================
  // SAVE USER
  // ==========================================

  saveUser(user: any): void {

    localStorage.setItem(
      'user',
      JSON.stringify(user)
    );

  }


  // ==========================================
  // GET LOGGED-IN USER
  // ==========================================

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


  // ==========================================
  // LOGOUT
  // ==========================================

  logout(): void {

    localStorage.removeItem('user');

  }


  // ==========================================
  // CHECK LOGIN
  // ==========================================

  isLoggedIn(): boolean {

    return !!localStorage.getItem('user');

  }

}