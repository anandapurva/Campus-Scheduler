import { Component } from '@angular/core';
import { DashboardService } from '../../../services/dashboard';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AcademicSessionService } from '../../../services/academic-session';
@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

  programCount = 0;

  batchCount = 0;

  roomCount = 0;

  facultyCount = 0;
  academicSessionName = '';
  academicSessionLoading = true;
  academicSessionError = '';

constructor(
  private dashboardService: DashboardService,
  private academicSessionService: AcademicSessionService,
  private cdr: ChangeDetectorRef
) {}

ngOnInit(): void {

  this.loadDashboardStats();
  this.loadActiveAcademicSession();

}


loadActiveAcademicSession(): void {
  this.academicSessionLoading = true;
  this.academicSessionError = '';

  this.academicSessionService.getActiveSession().subscribe({
    next: (response) => {

      if (response?.active && response?.session) {
        this.academicSessionName = response.session.session_name;
      } else {
        this.academicSessionName = '';
        this.academicSessionError = 'No active academic session';
      }

      this.academicSessionLoading = false;
    },

    error: (error) => {
      console.error('Error loading active academic session:', error);

      this.academicSessionName = '';
      this.academicSessionError = 'Unable to load academic session';
      this.academicSessionLoading = false;
    }
  });
}

loadDashboardStats(): void {

  this.dashboardService
    .getStats()
    .subscribe({

      next: (data) => {

        console.log(
          'DASHBOARD STATS:',
          data
        );

        this.programCount =
          data.programs || 0;

        this.batchCount =
          data.batches || 0;

        this.roomCount =
          data.rooms || 0;

        this.facultyCount =
          data.faculty || 0;

          this.cdr.detectChanges();

      },

      error: (error) => {

        console.error(
          'Failed to load dashboard stats:',
          error
        );

      }

    });

}




}