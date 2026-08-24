import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TimetableService } from '../../../services/timetable';
import { ProgramService } from '../../../services/program';
import { ChangeDetectorRef } from '@angular/core';
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


// -----------------------------------------
// PROGRAM & SEMESTER DATA
// -----------------------------------------

programs: any[] = [];

semesters: any[] = [];

selectedProgram = '';

selectedSemester = '';


onProgramChange(): void {

  console.log(
    'Selected Program:',
    this.selectedProgram
  );

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

  console.log(
    'Loading semesters for program ID:',
    programId
  );

  this.programService
    .getSemesters(programId)
    .subscribe({

      next: (data) => {

        console.log(
          'Available semesters:',
          data
        );

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
    private cdr: ChangeDetectorRef
  ) {}


  // -----------------------------------------
  // INIT
  // -----------------------------------------

  ngOnInit(): void {

    this.loadTeacherData();
     this.loadPrograms();

  }

  


  // -----------------------------------------
  // LOAD LOGGED-IN TEACHER
  // -----------------------------------------

  loadTeacherData(): void {

    /*
      For now we read the logged-in teacher
      information from localStorage.

      Later this can be replaced with
      AuthService / JWT.
    */

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

        console.log(
          'Programs loaded:',
          data
        );

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

  // =========================================
  // MY TIMETABLE
  // =========================================



  viewMyTimetable(): void {

    /*
      We use the logged-in teacher's faculty ID.

      Your timetable page can later use this
      faculty ID to load only this teacher's
      timetable.
    */

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

          program:
            this.selectedProgram,

          semester:
            this.selectedSemester

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

  lockLunchAndContinue(): void {

  // ==================================================
  // BASIC VALIDATION
  // ==================================================

  if (!this.selectedProgram) {

    console.error(
      'Program is missing'
    );

    return;

  }


  if (!this.selectedSemester) {

    console.error(
      'Semester is missing'
    );

    return;

  }


  if (!this.selectedLunch) {

    console.error(
      'Lunch break is missing'
    );

    return;

  }


  if (!this.department) {

    console.error(
      'Department is missing'
    );

    console.error(
      'Current department:',
      this.department
    );

    return;

  }


  if (!this.facultyId) {

    console.error(
      'Faculty ID is missing'
    );

    console.error(
      'Current facultyId:',
      this.facultyId
    );

    return;

  }


  // ==================================================
  // SPLIT LUNCH TIME
  // ==================================================

  const [
    lunchStart,
    lunchEnd
  ] = this.selectedLunch.split('-');


  if (!lunchStart || !lunchEnd) {

    console.error('Invalid lunch format:', this.selectedLunch );
    return;
  }


// ==================================================
// GET PROGRAM CODE
// ==================================================

const programCode = this.getProgramCode();

if (!programCode) {

  console.error( 'Invalid program:', this.selectedProgram );
  return;

}


// ==================================================
// PREPARE REQUEST
// ==================================================

const payload = {

  department:
    this.department.trim(),

  program:
    programCode,

  semester:
    Number(this.selectedSemester),

  lunchStart:
    lunchStart,

  lunchEnd:
    lunchEnd,

  facultyId:
    this.facultyId

};


  console.log( 'Complete Payload:', payload );


  // ==================================================
  // START LOADING
  // ==================================================

  this.lunchLoading = true;


  // ==================================================
  // CALL API
  // ==================================================

  this.timetableService
  .lockLunch(payload)
  .subscribe({

    next: (response) => {

      console.log('✅ LUNCH LOCKED SUCCESSFULLY');
      console.log('Response:', response);

      this.lunchLoading = false;

      this.lunchLocked = true;

      // Get saved lunch configuration
      if (response?.configuration) {

        const config = response.configuration;

        this.selectedLunch =
          `${config.lunchStart}-${config.lunchEnd}`;

      }

      console.log('Lunch locked:', this.lunchLocked);
      console.log('Opening timetable now...');

      this.createTimetable();

    },

    error: (error) => {
      console.error('❌ LUNCH LOCK FAILED');
      console.error('ERROR BODY:', error.error);

      this.lunchLoading = false;

      if (error.status === 409) {

        console.log('Lunch is already locked.');

        const config =
          error.error?.configuration;

        if (config) {

          this.lunchLocked = true;

          this.selectedLunch =
            `${config.lunchStart}-${config.lunchEnd}`;

        }

        return;
      }

      console.error(
        error.error?.message ||
        'Failed to lock lunch.'
      );

    }

  });

}

getProgramCode(): string {

  const program = this.programs.find(
    p => Number(p.id) === Number(this.selectedProgram)
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

  if (program.program_name === 'Integrated M.Tech') {
    return 'IMTECH';
  }

  return '';
}

checkLunchLock(): void {

  this.lunchLocked = false;
  this.selectedLunch = '';

  if (!this.selectedProgram || !this.selectedSemester) {
    return;
  }

  if (!this.department) {
    console.error('Department is missing');
    return;
  }

  const programCode = this.getProgramCode();

  if (!programCode) {
    console.error(
      'Invalid program:',
      this.selectedProgram
    );
    return;
  }

  const semesterNumber = Number(this.selectedSemester);

  if (!semesterNumber) {
    console.error(
      'Invalid semester:',
      this.selectedSemester
    );
    return;
  }

  this.checkingLunch = true;

  console.log(
    'Checking lunch configuration:',
    {
      department: this.department,
      program: programCode,
      semester: semesterNumber
    }
  );

  this.timetableService
    .getLunchConfiguration(
      this.department,
      programCode,
      semesterNumber
    )
    .subscribe({

      next: (response) => {

        console.log(
          'Lunch configuration response:',
          response
        );

        this.checkingLunch = false;

        if (
          response &&
          response.locked &&
          response.configuration
        ) {

          this.lunchLocked = true;

          const config =
            response.configuration;

          this.selectedLunch =
            `${config.lunchStart}-${config.lunchEnd}`;

          console.log(
            'Lunch already locked:',
            this.selectedLunch
          );

        } else {

          this.lunchLocked = false;
          this.selectedLunch = '';

          console.log(
            'No lunch configuration found.'
          );
        }

      },

      error: (error) => {

        console.error(
          'Lunch configuration request failed:',
          error
        );

        console.error(
          'Status:',
          error.status
        );

        console.error(
          'Error:',
          error.error
        );

        // VERY IMPORTANT
        this.checkingLunch = false;
        this.lunchLocked = false;
        this.selectedLunch = '';

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

      if (!this.canEdit) {

      alert('You do not have permission to edit the timetable.');

      return;

    }

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

        program:
          this.getProgramCode(),

        semester:
          Number(this.selectedSemester),

        lunch:
          this.selectedLunch

      }

    }
  );

}

}