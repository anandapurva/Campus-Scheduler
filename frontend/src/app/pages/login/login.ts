import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './login.html',

  styleUrl: './login.css'
})
export class Login {

  faculty_id = '';

  password = '';

  isLoading = false;

  errorMessage = '';


  constructor(
    private authService: AuthService,
    private router: Router
  ) {}


  login(): void {

    // Clear previous error
    this.errorMessage = '';


    // Check email
    if (!this.faculty_id.trim()) {

  this.errorMessage =
    'Please enter your Faculty ID.';

  return;

}


    // Check password
    if (!this.password) {

      this.errorMessage =
        'Please enter your password.';

      return;

    }


    // Show loading
    this.isLoading = true;


    console.log(
      'Sending login request...'
    );


    // Call backend
    this.authService.login(
  this.faculty_id.trim(),
  this.password
)
    .subscribe({

      // =====================================
      // SUCCESS
      // =====================================

      next: (response) => {

        console.log(
          'LOGIN RESPONSE:',
          response
        );

        this.isLoading = false;


        // Check user
        if (!response.user) {

          this.errorMessage =
            'Login response does not contain user information.';

          return;

        }


        // Save user
        this.authService.saveUser(
          response.user
        );


        const user = response.user;


        console.log(
          'LOGGED IN USER:',
          user
        );


        // =====================================
        // ADMIN
        // =====================================

        if (user.role === 'ADMIN') {

          console.log(
            'Redirecting to Admin Dashboard'
          );

          this.router.navigate([
            '/admin/dashboard'
          ]);

          return;

        }


        // =====================================
        // TEACHER
        // =====================================

        if (user.role === 'TEACHER') {

          console.log(
            'Redirecting to Teacher Dashboard'
          );

          this.router.navigate([
            '/teacher/dashboard'
          ]);

          return;

        }


        // =====================================
        // UNKNOWN ROLE
        // =====================================

        this.errorMessage =
          'Unknown user role: ' + user.role;

      },


      // =====================================
      // ERROR
      // =====================================

      error: (error) => {

        console.error(
          'LOGIN ERROR:',
          error
        );

        this.isLoading = false;


        if (error.error?.message) {

          this.errorMessage =
            error.error.message;

        } else {

          this.errorMessage =
            'Unable to connect to server.';

        }

      }

    });

  }

}