import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DashboardService } from '../../../services/dashboard';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

  programCount = 0;

batchCount = 0;

roomCount = 0;

facultyCount = 0;

constructor(
  private dashboardService: DashboardService,
  private cdr: ChangeDetectorRef
) {}

ngOnInit(): void {

  this.loadDashboardStats();

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