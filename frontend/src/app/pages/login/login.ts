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

  // ==========================================
  // FORM
  // ==========================================

  email = '';

  password = '';


  // ==========================================
  // UI STATE
  // ==========================================

  isLoading = false;

  errorMessage = '';


  constructor(
    private authService: AuthService,

    private router: Router
  ) {}


  // ==========================================
  // LOGIN
  // ==========================================

  login(): void {

    this.errorMessage = '';


    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!this.email.trim()) {

      this.errorMessage =
        'Please enter your email.';

      return;

    }


    if (!this.password) {

      this.errorMessage =
        'Please enter your password.';

      return;

    }


    // ------------------------------------------
    // LOADING
    // ------------------------------------------

    this.isLoading = true;


    // ------------------------------------------
    // API
    // ------------------------------------------

    this.authService
      .login(
        this.email.trim(),
        this.password
      )
      .subscribe({

        next: (response) => {

          console.log(
            'LOGIN RESPONSE:',
            response
          );


          this.isLoading = false;


          // ------------------------------------
          // SAVE USER
          // ------------------------------------

          this.authService.saveUser(
            response.user
          );


          const user =
            response.user;


          // ------------------------------------
          // ADMIN
          // ------------------------------------

          if (
            user.role === 'ADMIN'
          ) {

            this.router.navigate([
              '/admin/dashboard'
            ]);

            return;

          }


          // ------------------------------------
          // TEACHER
          // ------------------------------------

          if (
            user.role === 'TEACHER'
          ) {

            this.router.navigate([
              '/teacher/dashboard'
            ]);

            return;

          }


          // ------------------------------------
          // UNKNOWN ROLE
          // ------------------------------------

          this.errorMessage =
            'Invalid user role.';

        },


        error: (error) => {

          console.error(
            'LOGIN ERROR:',
            error
          );


          this.isLoading = false;


          this.errorMessage =
            error.error?.message ||
            'Invalid email or password.';

        }

      });

  }

}