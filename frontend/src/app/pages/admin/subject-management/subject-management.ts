import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubjectService } from '../../../services/subject';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { ProgramService } from '../../../services/program';
@Component({
  selector: 'app-subject-management',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl:
    './subject-management.html',

  styleUrl:
    './subject-management.css'
})
export class SubjectManagement
  implements OnInit {


  // ==================================================
  // MASTER DATA
  // ==================================================

  programs: any[] = [];

  departments: any[] = [];

  semesters: any[] = [];


  // ==================================================
  // SELECTION
  // ==================================================

  selectedProgram = '';

  selectedDepartment = '';

  selectedSemester: number | null = null;


  // ==================================================
  // SUBJECT DATA
  // ==================================================

  subjects: any[] = [];

  filteredSubjects: any[] = [];


// ==================================================
// IMPORT RESULT
// ==================================================

importResult: any = null;


// ==================================================
// TOAST
// ==================================================

showToast = false;

toastType: 'success' | 'error' = 'success';

toastMessage = '';

  // ==================================================
  // CSV
  // ==================================================

  selectedFile:
    File | null = null;

  previewData: any[] = [];

  errors: any[] = [];

  totalRows = 0;

  validRows = 0;

  errorCount = 0;

  isPreviewing = false;

  isImporting = false;


  // ==================================================
  // SEARCH
  // ==================================================

  searchText = '';


  // ==================================================
  // ADD / EDIT
  // ==================================================

  showSubjectForm = false;

  isEditing = false;

  editingSubjectId:
    number | null = null;


  subjectForm: any = {

    course_code: '',

    subject_name: '',

    course_type: '',

    elective_group: '',

    L: 0,

    T: 0,

    P: 0,

    credits: 0

  };


  // ==================================================
  // COURSE TYPES
  // ==================================================

  courseTypes = [

    {
      value: 'CORE',
      label: 'Core'
    },

    {
      value: 'ELECTIVE',
      label: 'Elective'
    },

    {
      value: 'OPEN_ELECTIVE',
      label: 'Open Elective'
    }

  ];


  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private subjectService: SubjectService,
    private programService: ProgramService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}


  // ==================================================
  // INIT
  // ==================================================

  ngOnInit(): void {

    this.loadPrograms();

  }


  // ==================================================
  // LOAD PROGRAMS
  // ==================================================

  loadPrograms(): void {

    this.programService
      .getPrograms()
      .subscribe({

        next: (data) => {

          this.programs = data || [];

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


  // ==================================================
  // PROGRAM CHANGE
  // ==================================================

  onProgramChange(): void {

    this.selectedDepartment = '';

    this.selectedSemester = null;

    this.departments = [];

    this.semesters = [];

    this.subjects = [];

    this.filteredSubjects = [];


    if (!this.selectedProgram) {

      return;

    }


    this.loadDepartments();

    this.loadSemesters();

  }


  // ==================================================
  // LOAD DEPARTMENTS
  // ==================================================

  loadDepartments(): void {

    /*
     * IMPORTANT:
     *
     * This API should return departments
     * available for the selected program.
     *
     * Example:
     *
     * GET /api/departments?program=BTECH
     */

    this.http
      .get<any[]>(
        'http://localhost:5000/api/departments',
        {
          params: {
            program:
              this.selectedProgram
          }
        }
      )
      .subscribe({

        next: (data) => {

          this.departments = data || [];
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


  // ==================================================
  // LOAD SEMESTERS
  // ==================================================

  loadSemesters(): void {

    const selectedProgram = this.programs.find(
      (program: any) =>
        program.program_name === this.selectedProgram
    );

    if (!selectedProgram) {

      this.semesters = [];

      return;

    }

    this.programService
      .getSemesters(selectedProgram.id)
      .subscribe({

        next: (data) => {

          this.semesters = data || [];

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load semesters:',
            error
          );

          this.semesters = [];

        }

      });

  }


  // ==================================================
  // DEPARTMENT CHANGE
  // ==================================================

  onDepartmentChange(): void {

    this.selectedSemester = null;

    this.subjects = [];

    this.filteredSubjects = [];

  }


  // ==================================================
  // SEMESTER CHANGE
  // ==================================================

  onSemesterChange(): void {

    this.subjects = [];

    this.filteredSubjects = [];

    this.loadSubjects();

  }


  // ==================================================
  // LOAD SUBJECTS
  // ==================================================

  loadSubjects(): void {

    if (
      !this.selectedProgram ||
      !this.selectedDepartment ||
      !this.selectedSemester
    ) {

      return;

    }


    this.subjectService
      .getSubjects(

        this.selectedProgram,

        this.selectedDepartment,

        Number(
          this.selectedSemester
        )

      )
      .subscribe({

        next: (data) => {

          this.subjects =
            data || [];

          this.cdr.detectChanges();

          this.applySearch();

        },

        error: (error) => {

          console.error(
            'Failed to load subjects:',
            error
          );

          this.subjects = [];

          this.filteredSubjects = [];

        }

      });

  }


  // ==================================================
  // SEARCH
  // ==================================================

  onSearch(): void {

    this.applySearch();

  }


  applySearch(): void {

    const search =
      this.searchText
        .trim()
        .toLowerCase();


    if (!search) {

      this.filteredSubjects =
        [...this.subjects];

      return;

    }


    this.filteredSubjects =
      this.subjects.filter(
        subject =>

          String(
            subject.course_code || ''
          )
            .toLowerCase()
            .includes(search)

          ||

          String(
            subject.subject_name || ''
          )
            .toLowerCase()
            .includes(search)

          ||

          String(
            subject.course_type || ''
          )
            .toLowerCase()
            .includes(search)

          ||

          String(
            subject.elective_group || ''
          )
            .toLowerCase()
            .includes(search)

      );

  }


  // ==================================================
  // FILE SELECT
  // ==================================================

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


  // ==================================================
  // PREVIEW CSV
  // ==================================================

  preview(): void {

    if (!this.selectedFile) {

      return;

    }


    this.isPreviewing = true;


    this.subjectService
      .previewCSV(
        this.selectedFile
      )
      .subscribe({

        next: (response) => {

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
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'CSV preview failed:',
            error
          );

          this.isPreviewing = false;

        }

      });

  }


  // ==================================================
  // IMPORT CSV
  // ==================================================

// ==================================================
// IMPORT SUBJECTS
// ==================================================

// ==================================================
// IMPORT SUBJECTS
// ==================================================

importSubjects(): void {

  console.log('====================================');
  console.log('SUBJECT IMPORT CLICKED');
  console.log('====================================');

  // ------------------------------------------
  // VALIDATION
  // ------------------------------------------

  if (this.errorCount > 0) {

    this.showToastMessage(
  'Please fix all CSV errors before importing.',
  'error'
);

    return;

  }


  if (this.previewData.length === 0) {

    this.showToastMessage(
      'No subject data available to import.',
      'error'
    );

    return;

  }


  if (
    !this.selectedProgram ||
    !this.selectedDepartment ||
    !this.selectedSemester
  ) {

    this.showToastMessage(
      'Please select program, department and semester.',
      'error'
    );

    return;

  }


  // ------------------------------------------
  // PREVENT DOUBLE CLICK
  // ------------------------------------------

  if (this.isImporting) {

    return;

  }


  console.log(
    'Program:',
    this.selectedProgram
  );

  console.log(
    'Department:',
    this.selectedDepartment
  );

  console.log(
    'Semester:',
    this.selectedSemester
  );

  console.log(
    'Subjects:',
    this.previewData.length
  );


  // ------------------------------------------
  // START IMPORT
  // ------------------------------------------

  this.isImporting = true;

  this.cdr.detectChanges();


  // ------------------------------------------
  // API CALL
  // ------------------------------------------

  this.subjectService

    .importSubjects(

      this.previewData,

      this.selectedProgram,

      this.selectedDepartment,

      Number(this.selectedSemester)

    )

    .pipe(

      finalize(() => {

        console.log(
          'SUBJECT IMPORT FINISHED'
        );

        this.isImporting = false;

        this.cdr.detectChanges();

      })

    )

    .subscribe({

      // ======================================
      // SUCCESS
      // ======================================

      next: (response) => {

        console.log(
          'SUBJECT IMPORT SUCCESS:',
          response
        );


        // ------------------------------------
        // SAVE RESULT
        // ------------------------------------

        this.importResult = {

          total:
            response.total ??
            this.previewData.length,

          inserted:
            response.inserted ??
            0,

          updated:
            response.updated ??
            0,

          unchanged:
            response.unchanged ??
            0

        };


        console.log(
          'IMPORT RESULT:',
          this.importResult
        );


        // ------------------------------------
        // SHOW TOAST
        // ------------------------------------

        this.showToastMessage(
          `Subjects imported successfully. ` +
          `${response.inserted ?? 0} inserted, ` +
          `${response.updated ?? 0} updated, ` +
          `${response.unchanged ?? 0} unchanged.`,
          'success'
        );


        // ------------------------------------
        // REFRESH SUBJECT LIST
        // ------------------------------------

        this.loadSubjects();


        // ------------------------------------
        // CLEAR PREVIEW
        // ------------------------------------

        this.previewData = [];

        this.errors = [];

        this.totalRows = 0;

        this.validRows = 0;

        this.errorCount = 0;


        this.cdr.detectChanges();

      },


      // ======================================
      // ERROR
      // ======================================

      error: (error) => {

        console.error(
          'SUBJECT IMPORT ERROR:',
          error
        );


        this.showToastMessage(

          error?.error?.message ||

          error?.error?.error ||

          'Subject import failed.',
          'error'

        );


        this.cdr.detectChanges();

      }

    });

}


  // ==================================================
  // ADD SUBJECT
  // ==================================================

  addSubject(): void {

    if (
      !this.selectedProgram ||
      !this.selectedDepartment ||
      !this.selectedSemester
    ) {

      return;

    }


    this.isEditing = false;

    this.editingSubjectId = null;


    this.subjectForm = {

      course_code: '',

      subject_name: '',

      course_type: '',

      elective_group: '',

      L: 0,

      T: 0,

      P: 0,

      credits: 0

    };


    this.showSubjectForm = true;

  }


  // ==================================================
  // EDIT SUBJECT
  // ==================================================

  editSubject(
    subject: any
  ): void {

    this.isEditing = true;

    this.editingSubjectId =
      subject.id;


    this.subjectForm = {

      course_code:
        subject.course_code || '',

      subject_name:
        subject.subject_name || '',

      course_type:
        subject.course_type || '',

      elective_group:
        subject.elective_group || '',

      L:
        Number(subject.L || 0),

      T:
        Number(subject.T || 0),

      P:
        Number(subject.P || 0),

      credits:
        Number(subject.credits || 0)

    };


    this.showSubjectForm = true;

  }


  // ==================================================
  // SAVE SUBJECT
  // ==================================================

  // ==================================================
// SAVE SUBJECT
// ==================================================

saveSubject(): void {

  if (
    !this.subjectForm.course_code ||
    !this.subjectForm.subject_name
  ) {

    this.showToastMessage(
      'Course code and subject name are required.',
      'error'
    );

    return;

  }


  const payload = {

    ...this.subjectForm,

    program:
      this.selectedProgram,

    department:
      this.selectedDepartment,

    semester:
      this.selectedSemester

  };


  // ==================================================
  // EDIT SUBJECT
  // ==================================================

  if (this.isEditing) {

    this.subjectService
      .updateSubject(
        this.editingSubjectId!,
        payload
      )
      .subscribe({

        next: (response) => {

          console.log(
            'SUBJECT UPDATE SUCCESS:',
            response
          );


          // ------------------------------------------
          // CLOSE FORM
          // ------------------------------------------

          this.showSubjectForm = false;


          // ------------------------------------------
          // SHOW SUCCESS TOAST
          // ------------------------------------------

          this.showToastMessage(
            'Subject updated successfully.',
            'success'
          );


          // ------------------------------------------
          // REFRESH SUBJECT LIST
          // ------------------------------------------

          this.loadSubjects();

        },


        error: (error) => {

          console.error(
            'Failed to update subject:',
            error
          );

          console.log(
            'STATUS:',
            error.status
          );

          console.log(
            'BACKEND MESSAGE:',
            error.error
          );


          this.showToastMessage(

            error?.error?.message ||

            error?.error?.error ||

            'Failed to update subject.',

            'error'

          );

        }

      });

  }


  // ==================================================
  // ADD SUBJECT
  // ==================================================

  else {

    this.subjectService
      .addSubject(payload)
      .subscribe({

        next: (response) => {

          console.log(
            'SUBJECT ADD SUCCESS:',
            response
          );


          // ------------------------------------------
          // CLOSE FORM
          // ------------------------------------------

          this.showSubjectForm = false;


          // ------------------------------------------
          // SHOW SUCCESS TOAST
          // ------------------------------------------

          this.showToastMessage(
            'Subject added successfully.',
            'success'
          );


          // ------------------------------------------
          // REFRESH SUBJECT LIST
          // ------------------------------------------

          this.loadSubjects();

        },


        error: (error) => {

          console.error(
            'Failed to create subject:',
            error
          );


          this.showToastMessage(

            error?.error?.message ||

            error?.error?.error ||

            'Failed to add subject.',

            'error'

          );

        }

      });

  }

}


  // ==================================================
  // DELETE SUBJECT
  // ==================================================

  deleteSubject(
    subject: any
  ): void {

    const confirmed =
      confirm(

        `Delete "${subject.subject_name}"?`

      );


    if (!confirmed) {

      return;

    }


    this.http
      .delete(

        `http://localhost:5000/api/subjects/${subject.id}`

      )
      .subscribe({

       next: (response) => {

  console.log(
    'SUBJECT DELETE SUCCESS:',
    response
  );

  this.showToastMessage(
    'Subject deleted successfully.',
    'success'
  );

  this.loadSubjects();

},

       error: (error) => {

  console.error(
    'Failed to delete subject:',
    error
  );

  this.showToastMessage(

    error?.error?.message ||

    error?.error?.error ||

    'Failed to delete subject.',

    'error'

  );

}

      });

  }


  // ==================================================
  // CLOSE FORM
  // ==================================================

  closeSubjectForm(): void {

    this.showSubjectForm = false;

  }


  // ==================================================
  // RESET CSV
  // ==================================================

 resetPreview(): void {

  this.previewData = [];

  this.errors = [];

  this.totalRows = 0;

  this.validRows = 0;

  this.errorCount = 0;

  this.isPreviewing = false;

}


  // ==================================================
  // FILE NAME
  // ==================================================

  get fileName(): string {

    return this.selectedFile
      ? this.selectedFile.name
      : 'No file selected';

  }

// ==================================================
// TOAST
// ==================================================

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

  }, 5000);

}


}