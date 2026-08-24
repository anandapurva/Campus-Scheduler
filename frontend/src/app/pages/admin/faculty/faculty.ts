import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacultyService } from '../../../services/faculty';
import { ChangeDetectorRef } from '@angular/core';
import { finalize } from 'rxjs';
import { DepartmentService } from '../../../services/department';
@Component({
  selector: 'app-faculty',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './faculty.html',

  styleUrl: './faculty.css'
})
export class Faculty implements OnInit {

  selectedFile: File | null = null;

  previewData: any[] = [];
  errors: any[] = [];

  totalRows = 0;
  validRows = 0;
  errorCount = 0;

  isPreviewing = false;
  isImporting = false;
  importCompleted = false;

  faculty: any[] = [];
  departments: any[] = [];
  // ==========================================
  // ADD / EDIT FACULTY
  // ==========================================

  showFacultyForm = false;
  isEditing = false;

  facultyForm: any = {
    id: null,
    faculty_id: '',
    name: '',
    abbreviation: '',
    department: ''
  };


  // ==========================================
  // IMPORT RESULT
  // ==========================================

  importResult: any = null;


  // ==========================================
  // TOAST
  // ==========================================

  toastMessage = '';

  toastType: 'success' | 'error' = 'success';

  showToast = false;


  // ==========================================
  // PREVIEW PAGINATION
  // ==========================================

  previewCurrentPage = 1;
  previewPageSize = 10;


  // ==========================================
  // FACULTY PAGINATION
  // ==========================================

  facultyCurrentPage = 1;
  facultyPageSize = 10;


  constructor(
    private facultyService: FacultyService,
    private departmentService: DepartmentService,
    private cdr: ChangeDetectorRef
  ) {}


  ngOnInit(): void {

    this.loadFaculty();
    this.loadDepartments();

  }


  // ==========================================
  // FILE SELECT
  // ==========================================

  onFileSelected(
    event: Event
  ): void {

    const input =
      event.target as HTMLInputElement;


    if (
      !input.files ||
      input.files.length === 0
    ) {
      return;
    }


    this.selectedFile =
      input.files[0];


    this.resetPreview();

  }


  // ==========================================
  // PREVIEW
  // ==========================================

  preview(): void {

    console.log('1. PREVIEW CLICKED');


    if (!this.selectedFile) {

      alert(
        'Please select a CSV file first.'
      );

      return;
    }


    console.log(
      '2. FILE:',
      this.selectedFile.name
    );


    this.isPreviewing = true;


    this.facultyService
      .previewCSV(this.selectedFile)
      .subscribe({

        next: (response) => {

          console.log(
            '3. RESPONSE RECEIVED:',
            response
          );


          this.previewData =
            response.data || [];


          this.errors =
            response.errors || [];


          this.totalRows =
            response.totalRows || 0;


          this.validRows =
            response.validRows || 0;


          this.errorCount =
            response.errorCount || 0;


          this.isPreviewing = false;


          this.previewCurrentPage = 1;


          this.cdr.detectChanges();


          console.log(
            '4. previewData:',
            this.previewData.length
          );


          console.log(
            '5. totalRows:',
            this.totalRows
          );


          console.log(
            '6. validRows:',
            this.validRows
          );


          console.log(
            '7. errorCount:',
            this.errorCount
          );

        },


        error: (error) => {

          console.error(
            'PREVIEW ERROR:',
            error
          );


          this.isPreviewing = false;


          alert(
            error.error?.message ||
            'Failed to preview CSV'
          );

        }

      });

  }


  // ==========================================
  // IMPORT
  // ==========================================

  importData(): void {

    if (this.errorCount > 0) {

      this.showToastMessage(
        'Please fix all CSV errors before importing.',
        'error'
      );

      return;
    }


    if (this.previewData.length === 0) {

      this.showToastMessage(
        'No data available to import.',
        'error'
      );

      return;
    }


    if (this.isImporting) {

      return;

    }


    this.isImporting = true;


    this.facultyService
      .importFaculty(this.previewData)

      .pipe(

        finalize(() => {

          this.isImporting = false;

          this.cdr.detectChanges();

        })

      )

      .subscribe({

        next: (response) => {

          console.log(
            'IMPORT SUCCESS:',
            response
          );


          this.importCompleted = true;


          this.importResult = {

            total:
              response.total || 0,

            inserted:
              response.inserted || 0,

            updated:
              response.updated || 0,

            unchanged:
              response.unchanged || 0

          };


          this.showToastMessage(
            'Faculty import completed successfully.',
            'success'
          );


          this.loadFaculty();


          this.resetPreview();

        },


        error: (error) => {

          console.error(
            'IMPORT ERROR:',
            error
          );


          this.showToastMessage(

            error.error?.message ||
            'Faculty import failed.',

            'error'

          );

        }

      });

  }


  // ==========================================
  // LOAD FACULTY
  // ==========================================

  loadFaculty(): void {

    this.facultyService
      .getFaculty()
      .subscribe({

        next: (data) => {

          this.faculty =
            data || [];


          // Make sure current page is valid

          if (
            this.facultyCurrentPage >
            this.facultyTotalPages &&
            this.facultyTotalPages > 0
          ) {

            this.facultyCurrentPage =
              this.facultyTotalPages;

          }


          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'Failed to load faculty:',
            error
          );

          this.faculty = [];

        }

      });

  }




  // ==========================================
  // LOAD DEPARTMENTS
  // ==========================================

loadDepartments(): void {

  this.departmentService
    .getDepartments()
    .subscribe({

      next: (data) => {

        console.log(
          'DEPARTMENTS:',
          data
        );

        this.departments =
          data || [];

        this.cdr.detectChanges();

      },

      error: (error) => {

        console.error(
          'Failed to load departments:',
          error
        );

        this.departments = [];

      }

    });

}

  // ==========================================
  // ADD FACULTY
  // ==========================================

 addFaculty(): void {

  this.isEditing = false;

  this.facultyForm = {
    id: null,
    faculty_id: '',
    name: '',
    abbreviation: '',
    department: ''
  };

  this.showFacultyForm = true;
}


  // ==========================================
  // EDIT FACULTY
  // ==========================================

  editFaculty(person: any): void {

  this.isEditing = true;

  this.facultyForm = {

    id: person.id,

    faculty_id:
      person.faculty_id || '',

    name:
      person.name || '',

    abbreviation:
      person.abbreviation || '',

    department:
      person.department || ''

  };

  this.showFacultyForm = true;
}


  // ==========================================
  // CLOSE ADD / EDIT MODAL
  // ==========================================

  closeFacultyForm(): void {

  this.showFacultyForm = false;

  this.isEditing = false;

  this.facultyForm = {
    id: null,
    faculty_id: '',
    name: '',
    abbreviation: '',
    department: ''
  };

}


  // ==========================================
  // SAVE FACULTY
  // ==========================================

  saveFaculty(): void {

    // -------------------------------
    // VALIDATION
    // -------------------------------

    if (
      !this.facultyForm.faculty_id ||
      !this.facultyForm.name ||
      !this.facultyForm.abbreviation ||
      !this.facultyForm.department
    ) {

      this.showToastMessage(
        'Please fill all faculty fields.',
        'error'
      );

      return;

    }


    // -------------------------------
    // EDIT
    // -------------------------------

    if (this.isEditing) {

      this.facultyService
        .updateFaculty(
          this.facultyForm.id,
          this.facultyForm
        )
        .subscribe({

          next: () => {

            this.showToastMessage(
              'Faculty updated successfully.',
              'success'
            );


            this.closeFacultyForm();

            this.loadFaculty();

          },


          error: (error) => {

            console.error(
              'UPDATE FACULTY ERROR:',
              error
            );


            this.showToastMessage(

              error.error?.message ||
              'Failed to update faculty.',

              'error'

            );

          }

        });


      return;

    }


    // -------------------------------
    // ADD
    // -------------------------------

    this.facultyService
      .createFaculty(
        this.facultyForm
      )
      .subscribe({

        next: (response) => {

  console.log(
    'ADD FACULTY SUCCESS:',
    response
  );

  this.closeFacultyForm();

  this.facultyCurrentPage = 1;

  this.loadFaculty();

  this.showToastMessage(
    'Faculty added successfully.',
    'success'
  );

},


        error: (error) => {

          console.error(
            'ADD FACULTY ERROR:',
            error
          );


          this.showToastMessage(

            error.error?.message ||
            'Failed to add faculty.',

            'error'

          );

        }

      });

  }


  // ==========================================
  // DELETE FACULTY
  // ==========================================

  deleteFaculty(person: any): void {

    const confirmed =
      confirm(
        `Are you sure you want to delete ${person.name}?`
      );


    if (!confirmed) {

      return;

    }


    this.facultyService
      .deleteFaculty(
        person.id
      )
      .subscribe({

        next: () => {

          this.showToastMessage(
            'Faculty deleted successfully.',
            'success'
          );


          this.loadFaculty();

        },


        error: (error) => {

          console.error(
            'DELETE FACULTY ERROR:',
            error
          );


          this.showToastMessage(

            error.error?.message ||
            'Failed to delete faculty.',

            'error'

          );

        }

      });

  }


  // ==========================================
  // RESET
  // ==========================================

  resetPreview(): void {

    this.previewData = [];

    this.errors = [];

    this.totalRows = 0;

    this.validRows = 0;

    this.errorCount = 0;

    this.importCompleted = false;

    this.previewCurrentPage = 1;

  }


  // ==========================================
  // FILE NAME
  // ==========================================

  get fileName(): string {

    return this.selectedFile
      ? this.selectedFile.name
      : 'No file selected';

  }


  // ==========================================
  // TOAST
  // ==========================================

  showToastMessage(
    message: string,
    type: 'success' | 'error' = 'success'
  ): void {

    this.toastMessage = message;

    this.toastType = type;

    this.showToast = true;

    this.cdr.detectChanges();


    setTimeout(() => {

      this.showToast = false;

      this.cdr.detectChanges();

    }, 4000);

  }


  // ==========================================
  // PREVIEW PAGINATION
  // ==========================================

  get paginatedPreviewData(): any[] {

    const start =
      (this.previewCurrentPage - 1) *
      this.previewPageSize;


    const end =
      start + this.previewPageSize;


    return this.previewData.slice(
      start,
      end
    );

  }


  get previewTotalPages(): number {

    return Math.ceil(

      this.previewData.length /
      this.previewPageSize

    );

  }

  // ==========================================
  // FACULTY SEARCH
  // ==========================================

  facultySearch = '';

  // ==========================================
  // FILTERED FACULTY
  // ==========================================

  get filteredFaculty(): any[] {

    const search =
      this.facultySearch
        .trim()
        .toLowerCase();

    // No search → show everyone
    if (!search) {

      return this.faculty;

    }

    return this.faculty.filter(person => {

      const facultyId =
        String(person.faculty_id || '')
          .toLowerCase();

      const name =
        String(person.name || '')
          .toLowerCase();

      const abbreviation =
        String(person.abbreviation || '')
          .toLowerCase();

      return (
        facultyId.includes(search) ||
        name.includes(search) ||
        abbreviation.includes(search)
      );

    });

  }


  // ==========================================
  // FACULTY PAGINATION
  // ==========================================

  get paginatedFaculty(): any[] {

    const start =
      (this.facultyCurrentPage - 1) *
      this.facultyPageSize;

    const end =
      start + this.facultyPageSize;

    return this.filteredFaculty.slice(
      start,
      end
    );

  }


  get facultyTotalPages(): number {

    return Math.ceil(
      this.filteredFaculty.length /
      this.facultyPageSize
    );

  }


  // ==========================================
  // PREVIEW PAGE NAVIGATION
  // ==========================================

  previousPreviewPage(): void {

    if (
      this.previewCurrentPage > 1
    ) {

      this.previewCurrentPage--;

    }

  }


  nextPreviewPage(): void {

    if (
      this.previewCurrentPage <
      this.previewTotalPages
    ) {

      this.previewCurrentPage++;

    }

  }


  // ==========================================
  // FACULTY PAGE NAVIGATION
  // ==========================================

  previousFacultyPage(): void {

    if (
      this.facultyCurrentPage > 1
    ) {

      this.facultyCurrentPage--;

    }

  }


  nextFacultyPage(): void {

    if (
      this.facultyCurrentPage <
      this.facultyTotalPages
    ) {

      this.facultyCurrentPage++;

    }

  }

}