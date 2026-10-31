import { Component } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-admin-layout',

  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],

  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {

  showLogout = false;

  constructor(
    private authService: AuthService
  ) {}

  toggleAdminMenu(): void {

    this.showLogout =
      !this.showLogout;

  }

  logout(): void {

    this.authService.logout();

  }

}