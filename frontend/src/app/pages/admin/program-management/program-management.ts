import { Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgramService } from '../../../services/program';

@Component({
  selector: 'app-program-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './program-management.html',
  styleUrl: './program-management.css'
})

export class ProgramManagement implements OnInit {

  programs: any[] = [];

  programName = '';

  totalSemesters = 8;

  editingId:
    number | null = null;

  loading = false;
  showForm = false;

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  toastVisible = false;

  private toastTimer: any;

  constructor(
    private programService: ProgramService,
    private cdr: ChangeDetectorRef
  ) {}


  ngOnInit(): void {

    this.loadPrograms();

  }


  loadPrograms(): void {

    this.loading = true;

    this.programService
      .getAllPrograms()
      .subscribe({

        next: (data) => {

          this.programs = data;

          this.loading = false;
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load programs:',
            error
          );

          this.loading = false;

        }

      });

  }


  saveProgram(): void {

    if (!this.programName.trim()) {

      this.showToast(
        'Please enter program name.',
        'error'
      );

      return;
    }


    if (
      !this.totalSemesters ||
      this.totalSemesters <= 0
    ) {

      this.showToast(
        'Please enter valid total semesters.',
        'error'
      );

      return;
    }


    const data = {

      program_name:
        this.programName.trim(),

      total_semesters:
        Number(this.totalSemesters)

    };


    // ==========================================
    // UPDATE PROGRAM
    // ==========================================

    if (this.editingId) {

      this.programService
        .updateProgram(
          this.editingId,
          data
        )
        .subscribe({

          next: () => {

            this.showToast(
              'Program updated successfully.',
              'success'
            );

            // Close form
            this.closeForm();

            // Refresh table
            this.loadPrograms();

          },

          error: (error) => {

            this.showToast(
              error?.error?.message ||
              'Failed to update program.',
              'error'
            );

          }

        });

    }


    // ==========================================
    // CREATE PROGRAM
    // ==========================================

    else {

      this.programService
        .createProgram(data)
        .subscribe({

          next: () => {

            this.showToast(
              'Program created successfully.',
              'success'
            );

            // Close form
            this.closeForm();

            // Refresh table
            this.loadPrograms();

          },

          error: (error) => {

            this.showToast(
              error?.error?.message ||
              'Failed to create program.',
              'error'
            );

          }

        });

    }

  }

  openAddForm(): void {

  this.resetForm();

  this.showForm = true;

}

  editProgram(program: any): void {

    this.editingId = Number(program.id);

    this.programName =
      program.program_name;

    this.totalSemesters =
      Number(program.total_semesters);

    this.showForm = true;

  }

  toggleStatus(
    program: any
  ): void {

    const newStatus =
      Number(program.is_active) !== 1;


    this.programService
      .updateStatus(
        Number(program.id),
        newStatus
      )
      .subscribe({

        next: () => {

          this.loadPrograms();

        },

        error: (error) => {

          alert(
            error?.error?.message ||
            'Failed to update program status.'
          );

        }

      });

  }

  resetForm(): void {

    this.editingId = null;

    this.programName = '';

    this.totalSemesters = 8;

  }

  closeForm(): void {

  this.showForm = false;

  this.editingId = null;

  this.programName = '';

  this.totalSemesters = 1;

  }

  showToast(message: string,type: 'success' | 'error' = 'success'): void {

  this.toastMessage = message;
  this.toastType = type;
  this.toastVisible = true;

  clearTimeout(this.toastTimer);

  this.toastTimer = setTimeout(() => {

    this.toastVisible = false;

  }, 3000);

  }

}