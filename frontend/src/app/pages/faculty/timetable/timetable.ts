import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { ClassEditor } from '../class-editor/class-editor';
import { AcademicSessionService } from '../../../services/academic-session';
import { TimetableConfigService } from '../../../services/timetable-config';
import { TimetableService } from '../../../services/timetable';
import { ProgramService } from '../../../services/program';
import { DepartmentService } from '../../../services/department';
import { finalize } from 'rxjs';

export interface TimeSlot {

  id: number;
  start: string;
  end: string;
  label: string;

}


interface TimetableCell {

  day: string;
  slot: TimeSlot;
  data: any[];

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


  timetableStatus: 'DRAFT' | 'FINALIZED' = 'DRAFT';

  isFinalized = false;

  finalizeLoading = false;
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

  academicSessionId: number | null = null;
  academicSessionStartYear: number | null = null;
  academicSessionName = '';

  academicSessionLoading = false;
  academicSessionError = '';

semesterId: number | null = null;
  programId: number | null = null;
departmentId: number | null = null;


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

  showValidationModal = false;
  validationErrors: any[] = [];
  validationMessage = '';
  editingEntry: any = null;

  constructor(

    private authService: AuthService,

    private route: ActivatedRoute,

    private router: Router,
    private academicSessionService: AcademicSessionService,
    private timetableConfigService: TimetableConfigService,
    private cdr: ChangeDetectorRef,
    private timetableService: TimetableService,
    private programService: ProgramService,
    private departmentService: DepartmentService


  ) {}


  ngOnInit(): void {

    this.loadTeacher();

    this.createEmptyTimetable();

    this.loadSelection();

  }

  // TEACHER

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

    this.canEdit =
      Number(user.can_edit) === 1;

  }

  onDelete(entryId: number): void {

  this.timetableService
    .deleteTimetableEntry(entryId)
    .subscribe({

      next: () => {

        alert('Class deleted successfully.');

        // Close editor
        this.closeEditor();

        // Reload timetable
        this.loadTimetable();

      },

      error: (error) => {

        console.error(
          'Failed to delete timetable entry:',
          error
        );

        alert(
          error?.error?.message ||
          'Failed to delete class.'
        );

      }

    });

}
  // PROGRAM / SEMESTER
loadSelection(): void {

  this.route.queryParams.subscribe(params => {

    this.program =
      String(params['program'] || '')
        .trim()
        .toUpperCase();

    this.department =
      String(params['department'] || '')
        .trim()
        .toUpperCase();

    this.programId =
      params['programId']
        ? Number(params['programId'])
        : null;

    this.departmentId =
      params['departmentId']
        ? Number(params['departmentId'])
        : null;

    this.semesterId =
      params['semesterId']
        ? Number(params['semesterId'])
        : null;

    this.semester =
      params['semesterNumber']
        ? Number(params['semesterNumber'])
        : Number(params['semester'] || 0);

    this.academicSessionId =
      params['academicSessionId']
        ? Number(params['academicSessionId'])
        : null;

    // Load session information
    this.loadAcademicSession();

    this.loadLunchConfiguration();

  });
}


  loadLunchConfiguration(): void {

    if (!this.program || !this.semester) {
      console.warn(
        'Cannot load lunch configuration: program or semester missing'
      );
      return;
    }

    const year = Math.ceil(this.semester / 2);

    this.timetableConfigService
      .getLunchConfiguration(this.program, year)
      .subscribe({

        next: (response: any) => {

          if (
            response?.locked === true &&
            response?.configuration
          ) {

            const configurations =
              Array.isArray(response.configuration)
                ? response.configuration
                : [response.configuration];

            const config = configurations.find(
              (item: any) =>
                Number(item.semester) === Number(this.semester)
            );

            if (config) {

              this.lunchStart =
                config.lunchStart;

              this.lunchEnd =
                config.lunchEnd;

            } else {

              console.warn(
                'No lunch configuration found for selected semester:',
                this.semester
              );

              this.lunchStart = '';
              this.lunchEnd = '';
            }

          } else {

            this.lunchStart = '';
            this.lunchEnd = '';
          }

          // IMPORTANT:
          // Force Angular to update the timetable immediately.
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Error loading lunch configuration:',
            error
          );

          this.lunchStart = '';
          this.lunchEnd = '';

          this.cdr.detectChanges();

        }

      });
  }

  loadAcademicSession(): void {

    this.academicSessionLoading = true;
    this.academicSessionError = '';

    this.academicSessionService
      .getActiveSession()
      .subscribe({

        next: (response) => {

          this.academicSessionLoading = false;


          if (
            !response.active ||
            !response.session
          ) {

            this.academicSessionId = null;

            this.academicSessionStartYear = null;

            this.academicSessionName = '';

            this.academicSessionError =
              'No academic session is currently active.';

            return;
          }


          const session =
            response.session;


          this.academicSessionId =
            Number(session.id);

          this.academicSessionStartYear =
            Number(session.start_year);

          this.academicSessionName =
            session.session_name;

          this.loadLunchConfiguration();

          this.loadExistingTimetable();

        },


        error: (error) => {

          console.error(
            'Error loading academic session:',
            error
          );


          this.academicSessionLoading = false;

          this.academicSessionId = null;

          this.academicSessionStartYear = null;

          this.academicSessionError =
            'Unable to load the active academic session.';

        }

      });

  }

  // ==========================================
  // LOAD EXISTING TIMETABLE
  // ==========================================

  loadTimetable(): void {

    if (!this.academicSessionId) {
      console.warn('Cannot load timetable: academic session missing');
      return;
    }

    if (!this.program || !this.semester) {
      console.warn('Cannot load timetable: program or semester missing');
      return;
    }

    const programId = Number(
      this.route.snapshot.queryParams['programId']
    );

    const departmentId = Number(
      this.route.snapshot.queryParams['departmentId']
    );

    const semesterId = Number(
      this.route.snapshot.queryParams['semesterId']
    );

    if (!programId || !departmentId || !semesterId) {

      console.warn(
        'Cannot load timetable: missing programId, departmentId or semesterId',
        {
          programId,
          departmentId,
          semesterId
        }
      );

      return;
    }

    this.timetableService
      .getTimetable(
        this.academicSessionId,
        programId,
        departmentId,
        semesterId
      )
      .subscribe({

        next: (response: any) => {

          if (
            !response?.success ||
            !Array.isArray(response.entries)
          ) {
            console.warn('No timetable entries found');

            return;
          }

          this.populateTimetable(
            response.entries
          );

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Failed to load timetable:',
            error
          );

        }

      });
  }

loadTimetableStatus(): void {

  if (
    !this.academicSessionId ||
    !this.programId ||
    !this.departmentId ||
    !this.semesterId
  ) {
    return;
  }

  this.timetableService.getTimetableStatus(
    this.academicSessionId,
    this.programId,
    this.departmentId,
    this.semesterId
  ).subscribe({
    next: (response) => {

      this.timetableStatus = response.status;
      this.isFinalized = response.status === 'FINALIZED';

    },
    error: (error) => {
      console.error(
        'Failed to load timetable status',
        error
      );
    }
  });
}

private buildTimetablePayload(
  data: any,
  slot: TimeSlot,
  practicalSessionId?: string
): any {

  return {

    academicSessionId:
      Number(this.academicSessionId),

    programId:
      Number(data.programId),

    departmentId:
      Number(data.departmentId),

    semesterId:
      Number(data.semesterId),

    day:
      this.selectedCell?.day,

    slotId:
      Number(slot.id),

    startTime:
      slot.start,

    endTime:
      slot.end,

    subjectId:
      Number(data.subjectId),

    lectureType:
      data.lectureType,

    roomId:
      Number(data.roomId),

    batchIds:
      data.batchIds || [],

    teacherIds:
      data.teacherIds || [],

    totalStudents:
      Number(data.totalStudents || 0),

    ...(practicalSessionId
      ? { practicalSessionId }
      : {})

  };
}

getNextSlot(selectedCell: any): TimeSlot | null {
  return this.timetableService.getNextSlot(
    selectedCell,
    this.timeSlots
  );
}


finalizeTimetable(): void {
  if (this.isFinalized || this.finalizeLoading) {
    return;
  }

  if (
    this.academicSessionId == null ||
    this.programId == null ||
    this.departmentId == null ||
    this.semesterId == null
  ) {
    alert(
      'Please select an academic session, program, department and semester.'
    );
    return;
  }

  const confirmed = window.confirm(
    'Are you sure you want to finalize this timetable? ' +
    'The system will check all batches and subjects for L/T/P completion.'
  );

  if (!confirmed) {
    return;
  }

  this.finalizeLoading = true;
  this.cdr.detectChanges();

  this.timetableService.finalizeTimetable({
    academicSessionId: this.academicSessionId,
    programId: this.programId,
    departmentId: this.departmentId,
    semesterId: this.semesterId
  }).subscribe({
    next: (response: any) => {
      if (response?.success && response?.finalized) {
        this.isFinalized = true;
        this.timetableStatus = 'FINALIZED';
        alert('Timetable finalized successfully.');
      } else {
        this.validationMessage =
          response?.message || 'Timetable validation failed.';

        this.validationErrors = Array.isArray(response?.errors)
          ? response.errors
          : [];

        if (this.validationErrors.length === 0) {
          this.validationErrors = [{
            type: 'GENERAL',
            message: this.validationMessage
          }];
        }

        this.showValidationModal = true;
      }

      this.finalizeLoading = false;
      this.cdr.detectChanges();
    },

    error: (error: any) => {
      const response = error?.error;

      this.validationMessage =
        response?.message || 'Unable to finalize timetable.';

      this.validationErrors = Array.isArray(response?.errors)
        ? response.errors
        : [];

      if (this.validationErrors.length === 0) {
        this.validationErrors = [{
          type: 'GENERAL',
          message: this.validationMessage
        }];
      }

      this.showValidationModal = true;
      this.finalizeLoading = false;

      console.log('Validation modal state:', {
        showValidationModal: this.showValidationModal,
        errors: this.validationErrors.length
      });

      this.cdr.detectChanges();
    }
  });
}



closeValidationModal(): void {
  this.showValidationModal = false;
}

getValidationIssueCount(error: any): number {
  const missing = error?.missing ?? {};
  const excess = error?.excess ?? {};

  return ['L', 'T', 'P'].reduce((count, type) => {
    return count
      + (Number(missing[type]) > 0 ? 1 : 0)
      + (Number(excess[type]) > 0 ? 1 : 0);
  }, 0);
}

showTimetableValidationErrors(response: any): void {
  const errors = Array.isArray(response)
    ? response
    : Array.isArray(response?.errors)
      ? response.errors
      : [];

  if (errors.length === 0) {
    console.error('Timetable validation failed, but no validation errors were returned:', response);
    alert(response?.message || 'Unable to finalize timetable. Check the browser console and backend response.');
    return;
  }

  const messages = errors.map((error: any) => {
    // Handle general validation errors, such as NO_BATCHES or NO_SUBJECTS.
    if (error.type) {
      return error.message || error.type;
    }

    const missing = error.missing ?? {};
    const excess = error.excess ?? {};
    const required = error.required ?? {};
    const scheduled = error.scheduled ?? {};

    const details: string[] = [];

    for (const type of ['L', 'T', 'P']) {
      if ((missing[type] ?? 0) > 0) {
        details.push(`Missing ${type}: ${missing[type]}`);
      }

      if ((excess[type] ?? 0) > 0) {
        details.push(`Excess ${type}: ${excess[type]}`);
      }
    }

    return [
      `${error.batchCode || 'Batch'} — ${error.courseCode || error.subjectName || 'Subject'}`,
      ...details,
      `Required: L ${required.L ?? 0}, T ${required.T ?? 0}, P ${required.P ?? 0}`,
      `Scheduled: L ${scheduled.L ?? 0}, T ${scheduled.T ?? 0}, P ${scheduled.P ?? 0}`
    ].join('\n');
  });

  alert(
    `${response?.message || 'Timetable validation failed.'}\n\n` +
    messages.join('\n\n')
  );
}

unfinalizeTimetable(): void {

  const confirmed = window.confirm(
    'Move this timetable back to DRAFT so it can be modified?'
  );

  if (!confirmed) {
    return;
  }

  if (
  this.academicSessionId == null ||
  this.programId == null ||
  this.departmentId == null ||
  this.semesterId == null
) {
  alert('Please select an academic session, program, department and semester.');
  return;
}

  this.timetableService.unfinalizeTimetable({
    academicSessionId: this.academicSessionId,
    programId: this.programId,
    departmentId: this.departmentId,
    semesterId: this.semesterId
  }).subscribe({

    next: () => {

      this.isFinalized = false;
      this.timetableStatus = 'DRAFT';

      alert(
        'Timetable is now in DRAFT status.'
      );

    },

    error: (error) => {

      alert(
        error?.error?.message ||
        'Unable to unfinalize timetable.'
          );

        }

      });
  }

  normalizeProgram(value: string): string {

    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  }

  loadExistingTimetable(): void {

    if (!this.academicSessionId) {

      console.warn(
        'Cannot load timetable: academic session ID missing'
      );

      return;
    }


    if (
      !this.programId ||
      !this.departmentId ||
      !this.semesterId
    ) {

      console.error(
        'Cannot load timetable: missing IDs',
        {
          programId: this.programId,
          departmentId: this.departmentId,
          semesterId: this.semesterId
        }
      );

      return;
    }

    this.timetableService
      .getTimetable(

        Number(
          this.academicSessionId
        ),

        Number(
          this.programId
        ),

        Number(
          this.departmentId
        ),

        Number(
          this.semesterId
        )

      )
      .subscribe({

        next: (response: any) => {

          if (
            response?.success &&
            Array.isArray(
              response.entries
            )
          ) {

            this.populateTimetable(
              response.entries
            );

          }


          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'Cannot load timetable:',
            error
          );

        }

      });

  }

  // ==========================================
  // POPULATE TIMETABLE GRID
  // ==========================================

  populateTimetable(entries: any[]): void {

  // Always start with a completely empty grid.
  this.createEmptyTimetable();


  for (const entry of entries) {

    const dayIndex =
      this.days.findIndex(
        day =>
          day.toLowerCase() ===
          String(entry.day || '')
            .trim()
            .toLowerCase()
      );


    const slotIndex =
      this.timeSlots.findIndex(
        slot =>
          Number(slot.id) ===
          Number(
            entry.slot_id ??
            entry.slotId
          )
      );


    if (
      dayIndex === -1 ||
      slotIndex === -1
    ) {

      console.warn(
        'Could not map timetable entry:',
        entry
      );

      continue;

    }


    const cell =
      this.timetable[dayIndex][slotIndex];


    // Convert database entry into the object
    // used by the timetable HTML.
    const timetableEntry = {

      id:
        entry.id,

      lectureType:
        entry.lecture_type ??
        entry.lectureType,

      subjectId:
        entry.subject_id ??
        entry.subjectId,

      subjectCode:
        entry.subject_code ??
        entry.subjectCode,

      subjectName:
        entry.subject_name ??
        entry.subjectName,

      room:
        entry.room_code ??
        entry.room_id ??
        entry.room_name ??
        entry.room,

      roomId:
        entry.room_id ??
        entry.roomId,

      roomName:
        entry.room_name ??
        entry.roomName,

      roomType:
        entry.room_type ??
        entry.roomType,

      roomCapacity:
        entry.room_capacity ??
        entry.roomCapacity,

      totalStudents:
        Number(
          entry.total_students ??
          entry.totalStudents ??
          0
        ),

      batches:
        Array.isArray(entry.batches)
          ? entry.batches
          : [],

      teachers:
        Array.isArray(entry.teachers)
          ? entry.teachers
          : []

    };


    /*
     * IMPORTANT:
     *
     * Do NOT do:
     *
     * cell.data = timetableEntry;
     *
     * because that would replace an existing class.
     *
     * Push allows multiple classes in the same slot.
     */
    cell.data.push(
      timetableEntry
    );

  }

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

        // IMPORTANT:
        // Every cell starts with an empty array.
        data: []

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

    if (!this.canEdit) {

      return;

    }


    this.selectedCell =
      cell;


    this.showEditor =
      true;

    this.showEditor= true;

    
  }
// ==========================================
// EDIT EXISTING ENTRY
// ==========================================

editTimetableEntry(
  cell: TimetableCell,
  entry: any
): void {

  if (!this.canEdit) {
    return;
  }

  if (!entry?.id) {
    console.error(
      'Cannot edit timetable entry: missing entry ID',
      entry
    );

    return;
  }

  this.selectedCell = cell;

 // Make a copy so the original timetable entry
  // is not modified while editing.
  this.editingEntry = {
    ...entry,
    id: Number(entry.id),

    subjectId: entry.subjectId
      ? Number(entry.subjectId)
      : null,

    roomId: entry.roomId
      ? Number(entry.roomId)
      : null,

    batchIds: Array.isArray(entry.batchIds)
      ? [...entry.batchIds]
      : (Array.isArray(entry.batches)
          ? entry.batches.map((b: any) => Number(b.id))
          : []),

    teacherIds: Array.isArray(entry.teacherIds)
      ? [...entry.teacherIds]
      : (Array.isArray(entry.teachers)
          ? entry.teachers.map((t: any) => Number(t.id))
          : [])
  };

  this.showEditor = true;
}

  // ==========================================
  // CLOSE EDITOR
  // ==========================================

  closeEditor(): void {

    this.showEditor =
      false;

    this.selectedCell =
      null;
    this.editingEntry = 
      null;
    

  }


  // ==========================================
  // SAVE CELL
  // ==========================================


  saveCell(data: any): void {
  if (!this.selectedCell) {
    return;
  }

  if (this.academicSessionId == null) {
    alert('No active academic session found.');
    return;
  }

  const entryId = this.editingEntry?.id
    ? Number(this.editingEntry.id)
    : null;

  // ==================================================
  // PRACTICAL: TWO CONSECUTIVE SLOTS
  // ==================================================

  if (data.lectureType === 'P') {
    const firstSlot = data.practicalSlots?.[0];
    const secondSlot = data.practicalSlots?.[1];

    if (!firstSlot || !secondSlot) {
      alert('Practical class requires two consecutive slots.');
      return;
    }

    // Avoid accidentally creating a duplicate practical session
    // when the editor is opened for an existing entry.
    if (entryId) {
      alert(
        'Editing an existing practical session is not supported by ' +
        'this save flow yet. Please cancel and reopen the practical.'
      );
      return;
    }

    const practicalSessionId = crypto.randomUUID();

    const firstPayload = this.buildTimetablePayload(
      data,
      firstSlot,
      practicalSessionId
    );

    const secondPayload = this.buildTimetablePayload(
      data,
      secondSlot,
      practicalSessionId
    );

    console.log('FIRST PRACTICAL SLOT:', firstPayload);
    console.log('SECOND PRACTICAL SLOT:', secondPayload);

    this.timetableService
      .createTimetableEntry(firstPayload)
      .subscribe({
        next: () => {
          this.timetableService
            .createTimetableEntry(secondPayload)
            .subscribe({
              next: () => {
                this.closeEditor();
                this.loadExistingTimetable();

                alert(
                  '2-hour practical class added successfully.'
                );
              },

              error: (error) => {
                console.error(
                  'Failed to save second practical slot:',
                  error
                );

                alert(
                  error?.error?.message ||
                  'The first practical slot was saved, but the ' +
                  'second slot failed. Please check the timetable ' +
                  'before retrying.'
                );

                // Reload because the first request may have succeeded.
                this.loadExistingTimetable();
              }
            });
        },

        error: (error) => {
          console.error(
            'Failed to save first practical slot:',
            error
          );

          alert(
            error?.error?.message ||
            'Failed to save the first practical slot.'
          );
        }
      });

    return;
  }

  // ==================================================
  // LECTURE / TUTORIAL: CREATE OR UPDATE
  // ==================================================

  const payload = this.buildTimetablePayload(
    data,
    this.selectedCell.slot
  );

  console.log(
    entryId
      ? `UPDATING TIMETABLE ENTRY ID: ${entryId}`
      : 'CREATING NEW TIMETABLE ENTRY',
    payload
  );

  const request$ = entryId
    ? this.timetableService.updateTimetableEntry(
        entryId,
        payload
      )
    : this.timetableService.createTimetableEntry(payload);

  request$.subscribe({
    next: (response: any) => {
      console.log('TIMETABLE SAVE RESPONSE:', response);

      // Reload the authoritative database state instead of
      // relying on possibly incomplete editor data.
      this.closeEditor();
      this.loadExistingTimetable();

      alert(
        entryId
          ? 'Class updated successfully.'
          : 'Class added to timetable successfully.'
      );
    },

    error: (error) => {
      console.error(
        entryId
          ? 'Failed to update timetable entry:'
          : 'Failed to save timetable entry:',
        error
      );

      alert(
        error?.error?.message ||
        (
          entryId
            ? 'Failed to update timetable entry.'
            : 'Failed to save timetable entry.'
        )
      );
    }
  });
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

    // Check whether the timetable slot overlaps lunch
    return (
      slotStartMinutes < lunchEndMinutes &&
      slotEndMinutes > lunchStartMinutes
    );
  }

  timeToMinutes(time: string): number {

    const parts = time.split(':');

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    return (hours * 60) + minutes;
  }

}