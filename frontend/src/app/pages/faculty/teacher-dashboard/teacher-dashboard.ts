import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TimetableService } from '../../../services/timetable';
import { ProgramService } from '../../../services/program';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../../services/auth';
import { AcademicSessionService } from '../../../services/academic-session';
import { DepartmentService } from '../../../services/department';
@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './teacher-dashboard.html',
  styleUrl: './teacher-dashboard.css'
})
export class TeacherDashboard implements OnInit {

  // -----------------------------------------
  // TEACHER INFORMATION
  // -----------------------------------------

  teacherName = '';

  facultyId = '';

  department = '';

  canEdit = false;
 checkingLunch = false;

 showLogout = false;
departments: any[] = [];
selectedDepartment = '';

// -----------------------------------------
// PROGRAM & SEMESTER DATA
// -----------------------------------------

programs: any[] = [];

semesters: any[] = [];

selectedProgram = '';

onProgramChange(): void {

  // Reset department
  this.selectedDepartment = '';

  // Reset semester
  this.selectedSemester = '';

  // Clear old departments
  this.departments = [];

  // Clear old semesters
  this.semesters = [];

  // Reset lunch
  this.lunchLocked = false;
  this.selectedLunch = '';

  if (!this.selectedProgram) {
    return;
  }

  const programId = Number(this.selectedProgram);

  // ==========================================
  // LOAD DEPARTMENTS FOR SELECTED PROGRAM
  // ==========================================

  this.departmentService
    .getDepartmentsByProgram(programId)
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

onDepartmentChange(): void {

  // Reset semester
  this.selectedSemester = '';

  // Clear old semesters
  this.semesters = [];

  // Reset lunch
  this.lunchLocked = false;
  this.selectedLunch = '';

  if (!this.selectedDepartment) {
    return;
  }

  const programId = Number(this.selectedProgram);

  this.programService
    .getSemesters(programId)
    .subscribe({

      next: (data) => {

        this.semesters = data;

        this.cdr.detectChanges();

      },

      error: (error) => {

        console.error(
          'Failed to load semesters:',
          error
        );

      }

    });
}

toggleFacultyMenu(): void {
  this.showLogout = !this.showLogout;
}

getSelectedProgramName(): string {

  const program = this.programs.find(
    p => Number(p.id) === Number(this.selectedProgram)
  );

  return program
    ? program.program_name
    : '';

}

getSelectedSemesterName(): string {

  const semester = this.semesters.find(
    s => Number(s.id) === Number(this.selectedSemester)
  );

  return semester
    ? semester.semester_name
    : '';

}



  // -----------------------------------------
  // LUNCH OPTIONS
  // -----------------------------------------

  selectedLunch = '';

lunchLocked = false;

lunchLoading = false;
selectedSemester = '';       // semester ID
selectedSemesterNumber = 0;  // semester number

  // -----------------------------------------
  // TEACHER SEARCH
  // -----------------------------------------

  teacherSearch = '';


  // -----------------------------------------
  // CONSTRUCTOR
  // -----------------------------------------

  constructor(
    private router: Router,
    private timetableService: TimetableService,
    private programService: ProgramService,
    private authService: AuthService,
    private academicSessionService: AcademicSessionService,
    private departmentService: DepartmentService,
    private cdr: ChangeDetectorRef
  ) {}


  // -----------------------------------------
  // INIT
  // -----------------------------------------

  ngOnInit(): void {

    this.loadTeacherData();
     this.loadPrograms();
      this.loadDepartments();

  }

  // -----------------------------------------
  // LOAD LOGGED-IN TEACHER
  // -----------------------------------------

  loadTeacherData(): void {
    const user =
      localStorage.getItem('user');


    if (!user) {

      this.router.navigate(['/login']);

      return;

    }


    const userData =
      JSON.parse(user);


    this.teacherName =
      userData.full_name || 'Teacher';


    this.facultyId =
      userData.faculty_id || '';


    this.department =
      userData.department || '';


    this.canEdit =
      userData.can_edit === 1 ||
      userData.can_edit === true;

  }

  loadPrograms(): void {

    this.programService
      .getPrograms()
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
    this.departmentService.getDepartments().subscribe({
      next: (response) => {

        this.departments = response;
      },

      error: (error) => {
        console.error('Error loading departments:', error);
        this.departments = [];
      }
    });
  }

  logout(): void {
   this.authService.logout();
  }

  // =========================================
  // MY TIMETABLE
  // =========================================

  viewMyTimetable(): void {

    if (!this.facultyId) {

      alert('Faculty information not available.');

      return;

    }


    this.router.navigate(
      ['/teacher/my-timetable'],
      {
        queryParams: {
          facultyId: this.facultyId
        }
      }
    );

  }

  // =========================================
  // SEARCH TIMETABLE
  // =========================================

  viewTimetable(): void {

    if (!this.selectedProgram) {
      alert('Please select a program.');
      return;
    }

    if (!this.selectedDepartment) {
      alert('Please select a department.');
      return;
    }

    if (!this.selectedSemester) {
      alert('Please select a semester.');
      return;
    }


    const programId =
      Number(this.selectedProgram);

    const departmentId =
      Number(this.selectedDepartment);

    const semesterId =
      Number(this.selectedSemester);


    const semester =
      this.semesters.find(
        s => Number(s.id) === semesterId
      );


    if (!semester) {

      console.error(
        'Selected semester not found:',
        semesterId
      );

      alert('Invalid semester selected.');

      return;
    }


    const semesterNumber =
      Number(semester.semester_number);

    this.router.navigate(
      ['/teacher/timetable'],
      {
        queryParams: {

          // Display values
          program:
            this.getProgramCode(),

          department:
            this.getSelectedDepartmentName(),

          semester:
            semesterNumber,

          // Database IDs
          programId,
          departmentId,
          semesterId

        }
      }
    );

  }

  getSelectedDepartmentName(): string {

  const department = this.departments.find(
    d => Number(d.id) === Number(this.selectedDepartment)
  );

  return department
    ? department.name
    : '';

  }

  // =========================================
  // REQUEST EXTRA CLASS
  // =========================================

  requestExtraClass(): void {

    this.router.navigate(
      ['/teacher/extra-class']
    );

  }

  // =========================================
  // SEARCH TEACHER
  // =========================================

  searchTeacher(): void {

    const search =
      this.teacherSearch.trim();


    if (!search) {

      alert('Please enter a teacher name.');

      return;

    }


    this.router.navigate(
      ['/teacher/search'],
      {
        queryParams: {
          teacher: search
        }
      }
    );

  }

  // =========================================
  // CREATE TIMETABLE WITH LUNCH
  // =========================================

  getProgramCode(): string {

    const program = this.programs.find(
      p =>
        Number(p.id) ===
        Number(this.selectedProgram)
    );


    if (!program) {
      return '';
    }


    if (program.program_name === 'B.Tech') {
      return 'BTECH';
    }


    if (program.program_name === 'M.Tech') {
      return 'MTECH';
    }


    return '';
  }

  checkLunchLock(): void {

    this.lunchLocked = false;
    this.selectedLunch = '';

    if (!this.selectedProgram || !this.selectedSemester) {
      return;
    }

  const semesterId =
    Number(this.selectedSemester);


  const semester =
    this.semesters.find(
      s => Number(s.id) === semesterId
    );


  if (!semester) {

    console.error(
      'Cannot determine semester number for ID:',
      semesterId
    );

    return;
  }


  const semesterNumber =
    Number(semester.semester_number);


  if (
    !semesterNumber ||
    Number.isNaN(semesterNumber)
  ) {

    console.error(
      'Invalid semester number:',
      semester.semester_number
    );

    return;
  }


  const year =
    Math.ceil(semesterNumber / 2);

    const programCode = this.getProgramCode();

    if (!programCode) {
      console.error(
        'Invalid program:',
        this.selectedProgram
      );
      return;
    }

    this.checkingLunch = true;

    this.timetableService
      .getLunchConfiguration(programCode, year)
      .subscribe({

        next: (response: any) => {

          this.checkingLunch = false;

          this.lunchLocked =
            response?.locked === true;

          if (
            this.lunchLocked &&
            response?.configuration
          ) {

            const config = Array.isArray(
              response.configuration
            )
              ? response.configuration[0]
              : response.configuration;

            if (config) {
              this.selectedLunch =
                `${config.lunchStart}-${config.lunchEnd}`;
            }

          } else {

            this.selectedLunch = '';
          }

          this.cdr.detectChanges();
        },

        error: (error) => {

          this.checkingLunch = false;
          this.lunchLocked = false;
          this.selectedLunch = '';

          console.error(
            'Failed to check lunch configuration:',
            error
          );

          this.cdr.detectChanges();
        }
      });
  }

  onSemesterSelected(value: string): void {

    this.selectedSemester = value;

    const semesterId = Number(value);

    if (!value || Number.isNaN(semesterId)) {

      console.error(
        'Invalid semester ID:',
        value
      );

      return;
    }


    const semester =
      this.semesters.find(
        s => Number(s.id) === semesterId
      );


    if (!semester) {

      console.error(
        'Semester not found:',
        semesterId
      );

      return;
    }


    const semesterNumber = Number(semester.semester_number);

    this.checkLunchLock();

  }

  getLunchDisplay(): string {

    if (!this.selectedLunch) {

      return '';

    }


    const parts =
      this.selectedLunch.split('-');


    if (parts.length !== 2) {

      return this.selectedLunch;

    }


    const start =
      this.formatTime(parts[0]);

    const end =
      this.formatTime(parts[1]);


    return `${start} - ${end}`;

  }

  formatTime(time: string): string {

    if (!time) {

      return '';

    }


    const parts =
      time.split(':');


    let hour =
      Number(parts[0]);

    const minutes =
      parts[1];


    const period =
      hour >= 12
        ? 'PM'
        : 'AM';


    if (hour === 0) {

      hour = 12;

    }
    else if (hour > 12) {

      hour -= 12;

    }


    return `${hour}:${minutes} ${period}`;

  }

createTimetable(): void {

  if (!this.lunchLocked) {
    console.warn(
      'Lunch has not been locked by Admin.'
    );
    return;
  }

  if (!this.canEdit) {
    alert('You do not have permission to edit the timetable.');
    return;
  }

  if (!this.selectedProgram) {
    alert('Please select a program.');
    return;
  }

  if (!this.selectedDepartment) {
    alert('Please select a department.');
    return;
  }

  if (!this.selectedSemester) {
    alert('Please select a semester.');
    return;
  }

  // -----------------------------------------
  // GET SEMESTER ID
  // -----------------------------------------

  const semesterId =
    Number(this.selectedSemester);

  // -----------------------------------------
  // FIND ACTUAL SEMESTER NUMBER
  // -----------------------------------------

  const semester =
    this.semesters.find(
      s => Number(s.id) === semesterId
    );

  if (!semester) {
    console.error(
      'Selected semester not found:',
      semesterId
    );

    alert('Invalid semester selected.');
    return;
  }

  const semesterNumber =
    Number(semester.semester_number);

  if (
    !semesterNumber ||
    Number.isNaN(semesterNumber)
  ) {
    console.error(
      'Invalid semester number:',
      semester.semester_number
    );

    alert('Invalid semester number.');
    return;
  }

  // -----------------------------------------
  // CHECK ACTIVE ACADEMIC SESSION
  // -----------------------------------------

  this.academicSessionService
    .getActiveSession()
    .subscribe({

      next: (response) => {

        if (
          !response.active ||
          !response.session
        ) {

          alert(
            'Timetable creation is currently disabled. ' +
            'No academic session has been activated by the administrator.'
          );

          return;
        }

        const activeSession =
          response.session;

        // -----------------------------------------
        // NAVIGATE TO TIMETABLE
        // -----------------------------------------

        this.router.navigate(
          ['/teacher/timetable'],
          {
            queryParams: {

              // Display information
              program:
                this.getProgramCode(),

              department:
                this.getSelectedDepartmentName(),

              // IMPORTANT:
              // Actual semester NUMBER, NOT semester ID
              semester:
                semesterNumber,

              // Database IDs
              programId:
                Number(this.selectedProgram),

              departmentId:
                Number(this.selectedDepartment),

              // Database semester ID
              semesterId:
                semesterId,

              lunch:
                this.selectedLunch,

              academicSessionId:
                Number(activeSession.id)

            }
          }
        );

      },

      error: (error) => {

        console.error(
          'Error checking academic session:',
          error
        );

        alert(
          'Unable to check the active academic session. Please try again.'
        );

      }

    });
}

}