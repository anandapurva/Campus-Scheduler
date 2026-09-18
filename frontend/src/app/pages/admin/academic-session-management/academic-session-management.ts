import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AcademicSessionService } from '../../../services/academic-session';

@Component({
  selector: 'app-academic-session-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './academic-session-management.html',
  styleUrl: './academic-session-management.css'
})
export class AcademicSessionManagement implements OnInit {

  sessions: any[] = [];

  sessionForm = {
    session_name: '',
    start_year: null as number | null,
    end_year: null as number | null
  };

  loading = false;
  saving = false;
  message = '';
  errorMessage = '';

  constructor(
    private academicSessionService: AcademicSessionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;

    this.academicSessionService.getAllSessions().subscribe({
      next: (response) => {
        this.sessions = response.sessions || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
        this.errorMessage = 'Failed to load academic sessions';
        this.loading = false;
      }
    });
  }

  generateSessionName(): void {
    if (this.sessionForm.start_year) {
      this.sessionForm.end_year =
        Number(this.sessionForm.start_year) + 1;

      this.sessionForm.session_name =
        `${this.sessionForm.start_year}-${String(
          this.sessionForm.end_year
        ).slice(-2)}`;
    }
  }

  addSession(): void {
    this.message = '';
    this.errorMessage = '';

    if (
      !this.sessionForm.start_year ||
      !this.sessionForm.end_year
    ) {
      this.errorMessage = 'Please enter the start year';
      return;
    }

    this.saving = true;

    this.academicSessionService
      .addSession(this.sessionForm)
      .subscribe({
        next: (response) => {
          this.message = response.message;
          this.saving = false;

          this.sessionForm = {
            session_name: '',
            start_year: null,
            end_year: null
          };

          this.loadSessions();
        },
        error: (error) => {
          console.error('Error adding session:', error);

          this.errorMessage =
            error.error?.message ||
            'Failed to add academic session';

          this.saving = false;
        }
      });
  }

  activateSession(id: number): void {
    this.message = '';
    this.errorMessage = '';

    this.academicSessionService
      .activateSession(id)
      .subscribe({
        next: (response) => {
          this.message = response.message;
          this.loadSessions();
        },
        error: (error) => {
          console.error('Error activating session:', error);

          this.errorMessage =
            error.error?.message ||
            'Failed to activate academic session';
        }
      });
  }

  deactivateAll(): void {
    this.academicSessionService
      .deactivateAllSessions()
      .subscribe({
        next: (response) => {
          this.message = response.message;
          this.loadSessions();
        },
        error: (error) => {
          console.error('Error deactivating sessions:', error);

          this.errorMessage =
            error.error?.message ||
            'Failed to deactivate sessions';
        }
      });
  }
}