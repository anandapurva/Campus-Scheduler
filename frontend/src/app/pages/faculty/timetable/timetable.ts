import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { ClassEditor } from '../class-editor/class-editor';

interface TimeSlot {

  id: number;
  start: string;
  end: string;
  label: string;

}


interface TimetableCell {

  day: string;
  slot: TimeSlot;
  data: any | null;

}


@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [
    CommonModule,
    ClassEditor
  ],

  templateUrl: './timetable.html',
  styleUrl: './timetable.css'
})

export class Timetable implements OnInit {


  // ==========================================
  // TEACHER
  // ==========================================

  teacherName = '';
  facultyId = '';
  department = '';
  canEdit = false;
  lunchStart = '';
  lunchEnd = '';

  // ==========================================
  // PROGRAM / SEMESTER
  // ==========================================

  program = '';
  semester = 0;
  academicSessionStartYear = 0;


  // ==========================================
  // DAYS
  // ==========================================

  days = [

    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'

  ];


  // ==========================================
  // TIME SLOTS
  // ==========================================

  timeSlots: TimeSlot[] = [

    {
      id: 1,
      start: '08:00',
      end: '08:50',
      label: '8:00 - 8:50'
    },

    {
      id: 2,
      start: '09:00',
      end: '09:50',
      label: '9:00 - 9:50'
    },

    {
      id: 3,
      start: '10:00',
      end: '10:50',
      label: '10:00 - 10:50'
    },

    {
      id: 4,
      start: '11:00',
      end: '11:50',
      label: '11:00 - 11:50'
    },

    {
      id: 5,
      start: '12:00',
      end: '12:50',
      label: '12:00 - 12:50'
    },

    {
      id: 6,
      start: '13:00',
      end: '13:50',
      label: '1:00 - 1:50'
    },

    {
      id: 7,
      start: '14:00',
      end: '14:50',
      label: '2:00 - 2:50'
    },

    {
      id: 8,
      start: '15:00',
      end: '15:50',
      label: '3:00 - 3:50'
    },

    {
      id: 9,
      start: '16:00',
      end: '16:50',
      label: '4:00 - 4:50'
    },

    {
      id: 10,
      start: '17:00',
      end: '17:50',
      label: '5:00 - 5:50'
    }

  ];


  // ==========================================
  // TIMETABLE
  // ==========================================

  timetable: TimetableCell[][] = [];


  // ==========================================
  // POPUP
  // ==========================================

  showEditor = false;

  selectedCell: TimetableCell | null = null;


  constructor(

    private authService: AuthService,

    private route: ActivatedRoute,

    private router: Router

  ) {}


  ngOnInit(): void {

    this.loadTeacher();

    this.loadSelection();

    this.createEmptyTimetable();

  }


  // ==========================================
  // TEACHER
  // ==========================================

  loadTeacher(): void {

    const user =
      this.authService.getUser();


    if (!user) {

      this.router.navigate([
        '/login'
      ]);

      return;

    }


    this.teacherName =
      user.full_name || '';

    this.facultyId =
      user.faculty_id || '';

    this.department =
      user.department || '';

    this.canEdit =
      Number(user.can_edit) === 1;

  }


  // ==========================================
  // PROGRAM / SEMESTER
  // ==========================================

loadSelection(): void {

  this.route.queryParams
    .subscribe(params => {

       this.program =
        String(params['program'] || '').toUpperCase();

      this.semester =
        Number(params['semester'] || 0);

      this.academicSessionStartYear =
        Number(
          params['academicSessionStartYear'] || 0
        );

      const lunch =
        params['lunch'] || '';

      console.log('TIMETABLE PARAMS:', params);
      console.log('Lunch parameter:', lunch);

      if (lunch) {

        const parts =
          lunch.split('-');

        this.lunchStart =
          parts[0];

        this.lunchEnd =
          parts[1];

        console.log(
          'Lunch start:',
          this.lunchStart
        );

        console.log(
          'Lunch end:',
          this.lunchEnd
        );

      }

    });

}


  // ==========================================
  // CREATE EMPTY GRID
  // ==========================================

  createEmptyTimetable(): void {

    this.timetable = [];


    this.days.forEach(day => {

      const row: TimetableCell[] = [];


      this.timeSlots.forEach(slot => {

        row.push({

          day: day,

          slot: slot,

          data: null

        });

      });


      this.timetable.push(row);

    });

  }


  // ==========================================
  // OPEN CELL
  // ==========================================

  openCell(
    cell: TimetableCell
  ): void {

    // View-only teacher

    if (!this.canEdit) {

      return;

    }


    this.selectedCell =
      cell;


    this.showEditor =
      true;

  }


  // ==========================================
  // CLOSE EDITOR
  // ==========================================

  closeEditor(): void {

    this.showEditor =
      false;

    this.selectedCell =
      null;

  }


  // ==========================================
  // SAVE CELL
  // ==========================================

  saveCell(data: any): void {

    if (!this.selectedCell) {

      return;

    }


    this.selectedCell.data =
      data;


    this.closeEditor();

  }


  // ==========================================
  // GO BACK
  // ==========================================

  goBack(): void {

    this.router.navigate([
      '/teacher/dashboard'
    ]);

  }

isLunchSlot(slot: TimeSlot): boolean {

  if (!this.lunchStart || !this.lunchEnd) {
    return false;
  }

  const lunchStartMinutes =
    this.timeToMinutes(this.lunchStart);

  const lunchEndMinutes =
    this.timeToMinutes(this.lunchEnd);

  const slotStartMinutes =
    this.timeToMinutes(slot.start);

  const slotEndMinutes =
    this.timeToMinutes(slot.end);

  return (
    slotStartMinutes >= lunchStartMinutes &&
    slotStartMinutes < lunchEndMinutes
  );
}

timeToMinutes(time: string): number {

  const parts = time.split(':');

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  return (hours * 60) + minutes;
}

}