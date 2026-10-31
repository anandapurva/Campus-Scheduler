import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../../services/department';
import { ProgramService } from '../../../services/program';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './department-management.html',
  styleUrl: './department-management.css'
})

export class DepartmentManagement implements OnInit {

  departments: any[] = [];

  programs: any[] = [];

  departmentName = '';

  abbreviation = '';

  selectedProgramIds: number[] = [];
  selectedProgramFilter  = '';
  showForm = false;

  editingId: number | null = null;

  toastMessage = '';

  toastType: 'success' | 'error' = 'success';

  toastVisible = false;

  private toastTimer: any;


  constructor(
    private departmentService: DepartmentService,
    private programService: ProgramService,
    private cdr: ChangeDetectorRef
  ) {}


  ngOnInit(): void {

    this.loadPrograms();

    this.loadDepartments();

  }


  loadPrograms(): void {

    this.programService
      .getAllPrograms()
      .subscribe({

        next: (data) => {

          this.programs = data;
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load programs:',
            error
          );

        }

      });

  }


  loadDepartments(): void {

    this.departmentService
      .getDepartments()
      .subscribe({

        next: (data) => {

          this.departments = data;
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load departments:',
            error
          );

        }

      });

  }

  onProgramFilterChange(): void {

    if (!this.selectedProgramFilter) {

      this.loadDepartments();

      return;
    }

    this.departmentService
      .getDepartmentsByProgram(
        this.selectedProgramFilter
      )
      .subscribe({

        next: (data) => {

          this.departments = data;

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load departments by program:',
            error
          );

          this.departments = [];

          this.cdr.detectChanges();

        }

      });

  }

  openAddForm(): void {

  this.resetForm();

  this.showForm = true;

}

  toggleProgram(
    programId: number
  ): void {

    const index =
      this.selectedProgramIds
        .indexOf(programId);


    if (index >= 0) {

      this.selectedProgramIds
        .splice(index, 1);

    } else {

      this.selectedProgramIds
        .push(programId);

    }

  }


  isProgramSelected(
    programId: number
  ): boolean {

    return this.selectedProgramIds
      .includes(programId);

  }


  saveDepartment(): void {

    if (
      !this.departmentName.trim()
    ) {

      alert(
        'Please enter department name.'
      );

      return;

    }


    if (
      !this.abbreviation.trim()
    ) {

      alert(
        'Please enter abbreviation.'
      );

      return;

    }


    const data = {

      name:
        this.departmentName.trim(),

      abbreviation:
        this.abbreviation.trim(),

      programIds:
        this.selectedProgramIds

    };


    if (this.editingId) {

      this.departmentService
        .updateDepartment(
          this.editingId,
          data
        )
        .subscribe({

          next: () => {

            this.showToast(
                this.editingId
                  ? 'Department updated successfully.'
                  : 'Department added successfully.',
                'success'
              );

            this.resetForm();

            this.loadDepartments();

          },

          error: (error) => {

            this.showToast(
              error?.error?.message ||
              'Failed to update department.',
              'error'
            );

          }

        });

    } else {

      this.departmentService
        .createDepartment(data)
        .subscribe({

          next: () => {

            this.showToast(
              'Department added successfully.',
              'success'
            );

            this.resetForm();

            this.loadDepartments();

          },

          error: (error) => {

          this.showToast(
            error?.error?.message ||
            'Failed to create department.',
            'error'
          );
          }

        });

    }

  }

  editDepartment(department: any): void {

    this.editingId =
      Number(department.id);

    this.departmentName =
      department.name;

    this.abbreviation =
      department.abbreviation;

    this.showForm = true;

    this.loadDepartmentPrograms(
      Number(department.id)
    );

  }

  closeForm(): void {

    this.showForm = false;

    this.editingId = null;

    this.departmentName = '';

    this.abbreviation = '';

    this.selectedProgramIds = [];

  }


  loadDepartmentPrograms(
    departmentId: number
  ): void {

    this.departmentService
      .getProgramsByDepartment(departmentId)
      .subscribe({

        next: (programs) => {

          this.selectedProgramIds =
            programs.map(
              program =>
                Number(program.id)
            );

        },

        error: (error) => {

          console.error(
            'Failed to load department programs:',
            error
          );

          this.selectedProgramIds = [];

        }

      });

  }

  toggleStatus(
    department: any
  ): void {

    const newStatus =
      Number(department.is_active) !== 1;


    this.departmentService
      .updateStatus(
        Number(department.id),
        newStatus
      )
      .subscribe({

        next: () => {

          this.loadDepartments();

        },

        error: (error) => {

          alert(
            error?.error?.message ||
            'Failed to update department status.'
          );

        }

      });

  }


  resetForm(): void {

    this.closeForm();

  }

  toNumber(value: any): number {
    return Number(value);
  }

  showToast(message: string, type: 'success' | 'error' = 'success'): void {

  this.toastMessage = message;

  this.toastType = type;

  this.toastVisible = true;

  clearTimeout(this.toastTimer);

  this.toastTimer = setTimeout(() => {

    this.toastVisible = false;

  }, 3000);

  }

}