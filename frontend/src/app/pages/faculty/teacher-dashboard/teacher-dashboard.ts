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

selectedSemester = '';


onProgramChange(): void {


  // Reset semester
  this.selectedSemester = '';

  // Clear old semesters
  this.semesters = [];

  // Reset lunch
  this.lunchLocked = false;
  this.selectedLunch = '';

  if (!this.selectedProgram) {
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

toggleTeacherMenu(): void {
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


lunchOptions = [

  {
    value: '12:00:00-13:00:00',
    label: '12:00 PM - 1:00 PM'
  },

  {
    value: '13:00:00-14:00:00',
    label: '1:00 PM - 2:00 PM'
  },

  {
    value: '14:00:00-15:00:00',
    label: '2:00 PM - 3:00 PM'
  }

];



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


    if (!this.selectedSemester) {

      alert('Please select a semester.');

      return;

    }


    this.router.navigate(
      ['/teacher/timetable'],
      {
        queryParams: {

          program: this.selectedProgram,
          department: this.selectedDepartment,
          semester: this.selectedSemester

        }
      }
    );

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

  const semesterNumber = Number(this.selectedSemester);

  if (!semesterNumber || Number.isNaN(semesterNumber)) {
    console.error(
      'Invalid selected semester:',
      this.selectedSemester
    );
    return;
  }

  const year = Math.ceil(semesterNumber / 2);

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

  const semesterNumber = Number(value);

  if (!value || Number.isNaN(semesterNumber)) {

    console.error(
      'Invalid semester value:',
      value
    );

    return;
  }

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


  // Check whether admin has activated an academic session

  this.academicSessionService
    .getActiveSession()
    .subscribe({

      next: (response) => {

        // No active session
        if (!response.active || !response.session) {

          alert(
            'Timetable creation is currently disabled. ' +
            'No academic session has been activated by the administrator.'
          );

          return;

        }


        // Active session exists

        const activeSession =
          response.session;


        this.router.navigate(
          ['/teacher/timetable'],
          {
            queryParams: {

              program:
                this.getProgramCode(),

              department: 
                this.selectedDepartment,

              semester:
                Number(this.selectedSemester),

              lunch:
                this.selectedLunch,

              academicSessionId:
                activeSession.id

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