import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectorRef,
  OnChanges,
  OnInit,
  OnDestroy,
  SimpleChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { FacultyService } from '../../../services/faculty';
import { RoomService } from '../../../services/room';
import { AcademicSessionService } from '../../../services/academic-session';
import { BatchService, Batch } from '../../../services/batch';
import { SubjectService } from '../../../services/subject';
import { TimetableSocketService } from '../../../services/timetable-socket';
import { TimetableService } from '../../../services/timetable';


@Component({
  selector: 'app-class-editor',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './class-editor.html',
  styleUrl: './class-editor.css'
})
export class ClassEditor implements OnInit, OnChanges, OnDestroy {


  reservationId =
  `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 10)}`;
  // ==================================================
  // DESTROY SUBJECT
  // ==================================================

  private destroy$ = new Subject<void>();


  // ==================================================
  // INPUTS
  // ==================================================

  @Input()
  selectedCell: any;

  @Input()
  program = '';

  @Input()
  semester = 0;

  @Input()
  academicSessionId: number | null = null;

  @Input()
  academicSessionStartYear: number | null = null;

  @Input()
  department = '';


  // ==================================================
  // OUTPUTS
  // ==================================================

  @Output()
  save = new EventEmitter<any>();

  @Output()
  cancel = new EventEmitter<void>();


  // ==================================================
  // ACADEMIC SESSION
  // ==================================================

  academicSessions: any[] = [];

  selectedAcademicSessionId: number | null = null;

  selectedAcademicSessionStartYear: number | null = null;

  academicSessionLoading = false;

  academicSessionError = '';


  // ==================================================
  // BATCH DATA
  // ==================================================

  eligibleBatches: any[] = [];

  batches: Batch[] = [];

  selectedBatches: Batch[] = [];

  batchSearch = '';

  filteredBatches: any[] = [];

  loadingBatches = false;

  batchError = '';

  totalStudents = 0;


  // ==================================================
  // LUNCH
  // ==================================================

  lunchLocked = false;

  lunchStart = '';

  lunchEnd = '';

  lunchSource: any = null;

  checkingLunch = false;

  lunchMessage = '';

  lunchChecking = false;


  // ==================================================
  // LECTURE TYPE
  // ==================================================

  lectureType = 'L';

  lectureTypes = [
    {
      code: 'L',
      name: 'Lecture'
    },
    {
      code: 'T',
      name: 'Tutorial'
    },
    {
      code: 'P',
      name: 'Practical'
    }
  ];


  // ==================================================
  // MASTER DATA
  // ==================================================

  subjects: any[] = [];

  rooms: any[] = [];

  teachers: any[] = [];


  // ==================================================
  // SUBJECT
  // ==================================================

  isSubjectDropdownOpen = false;

  subjectSearch = '';

  filteredSubjects: any[] = [];

  selectedSubject: any = null;


  // ==================================================
  // TEACHERS
  // ==================================================

  teacherSearch = '';

  filteredTeachers: any[] = [];

  selectedTeachers: any[] = [];

  isTeacherDropdownOpen = false;


  // ==================================================
  // ROOM
  // ==================================================

  selectedRoom: any = null;

  roomDropdownOpen = false;

  roomSearch = '';

  filteredRooms: any[] = [];

  availableRooms: any[] = [];

  loadingRooms = false;


  // ==================================================
  // DROPDOWNS
  // ==================================================

  isBatchDropdownOpen = false;


  // ==================================================
  // REAL-TIME RESOURCE LOCKS
  // ==================================================

  lockedRoomIds = new Set<number>();

  lockedFacultyIds = new Set<number>();

  lockedBatchIds = new Set<number>();

  private heartbeatTimer: any;


  // ==================================================
  // LOADING
  // ==================================================

  loadingFaculty = false;

  temporaryRoomIds = new Set<number>();

  temporaryFacultyIds = new Set<number>();

  temporaryBatchIds = new Set<number>();

  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private facultyService: FacultyService,
    private roomService: RoomService,
    private batchService: BatchService,
    private subjectService: SubjectService,
    private academicSessionService: AcademicSessionService,
    private timetableSocketService: TimetableSocketService,
    private timetableService: TimetableService,
    private cdr: ChangeDetectorRef
  ) {}


  // ==================================================
  // INIT
  // ==================================================

  ngOnInit(): void {

    /*
     * Get values from parent.
     */
    this.selectedAcademicSessionId =
      this.academicSessionId;

    this.selectedAcademicSessionStartYear =
      this.academicSessionStartYear;


    /*
     * Load master data.
     */
    this.loadFaculty();

    this.loadRooms();

    this.loadSubjects();

    this.loadEligibleBatches();

    this.timetableSocketService
      .onResourceReservationUpdate(
        (data: any) => {

          console.log(
            'REAL-TIME RESERVATION UPDATE:',
            data
          );


          const resourceId =
            Number(data.resourceId);


          if (
            data.action === 'reserved'
          ) {

            this.addTemporaryLock(
              data.resourceType,
              resourceId
            );

          }


          if (
            data.action === 'released'
          ) {

            this.removeTemporaryLock(
              data.resourceType,
              resourceId
            );

          }


          this.cdr.detectChanges();

        }
      );


    this.timetableSocketService
  .onResourceReservationSnapshot(
    (data: any) => {

      console.log(
        'RESERVATION SNAPSHOT:',
        data
      );


      this.clearTemporaryLocks();


      if (
        Array.isArray(
          data?.reservations
        )
      ) {

        data.reservations.forEach(
          (reservation: any) => {

            this.addTemporaryLock(
              reservation.resourceType,
              Number(
                reservation.resourceId
              )
            );

          }
        );

      }


      this.cdr.detectChanges();

    }
  );

  this.timetableSocketService
  .onResourceReservationRejected(
    (data: any) => {

      console.warn(
        'RESERVATION REJECTED:',
        data
      );

      this.loadLockedResources();

      alert(
        data?.message ||
        'This resource is already being used by another coordinator.'
      );

    }
  );

    // If the component is already opened for a cell, load locks immediately

    this.loadLockedResources();

    this.joinTimetableCell();

    this.timetableSocketService.activity();

    this.heartbeatTimer =
    setInterval(() => {

      this.timetableSocketService.heartbeat();

    }, 20000);
  }

  // ==================================================
  // INPUT CHANGES
  // ==================================================

  ngOnChanges(changes: SimpleChanges): void {

    // --------------------------------------------------
    // ACADEMIC SESSION
    // --------------------------------------------------

    if (changes['academicSessionId']) {

      this.selectedAcademicSessionId =
        this.academicSessionId;

    }


    if (changes['academicSessionStartYear']) {

      this.selectedAcademicSessionStartYear =
        this.academicSessionStartYear;

    }


    // --------------------------------------------------
    // PROGRAM / SEMESTER / DEPARTMENT / SESSION
    // --------------------------------------------------

    if (
      changes['program'] ||
      changes['semester'] ||
      changes['department'] ||
      changes['academicSessionStartYear'] ||
      changes['academicSessionId']
    ) {

      this.loadEligibleBatches();

      this.loadSubjects();

    }


    // --------------------------------------------------
    // DEPARTMENT CHANGED
    // --------------------------------------------------

    if (changes['department']) {

      this.sortFaculty();

      this.filteredTeachers =
        [...this.teachers];

    }


    // --------------------------------------------------
    // CELL CHANGED
    // --------------------------------------------------

    if (
      changes['selectedCell'] ||
      changes['academicSessionId']
    ) {

      this.clearLockedResources();


      // Load locks for the new cell.
       
      this.loadLockedResources();

      // Join socket room for the new cell.
      
      this.joinTimetableCell();

    }

  }


  // ==================================================
  // ACTIVE ACADEMIC SESSION
  // ==================================================

  loadActiveAcademicSession(): void {

    this.academicSessionLoading = true;

    this.academicSessionError = '';


    this.academicSessionService
      .getActiveSession()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          this.academicSessionLoading = false;


          if (
            response?.active &&
            response?.session
          ) {

            this.academicSessions =
              [response.session];


            this.selectedAcademicSessionId =
              response.session.id;


            this.selectedAcademicSessionStartYear =
              Number(
                response.session.start_year
              );


            this.loadEligibleBatches();

          } else {

            this.academicSessions = [];

            this.selectedAcademicSessionId =
              null;

            this.selectedAcademicSessionStartYear =
              null;


            this.academicSessionError =
              'No academic session is currently active. Please contact the administrator.';

          }

        },

        error: (error) => {

          console.error(
            'Error loading active academic session:',
            error
          );


          this.academicSessionLoading = false;


          this.academicSessionError =
            'Unable to load the active academic session.';

        }

      });

  }


  // ==================================================
  // LOAD ELIGIBLE BATCHES
  // ==================================================

  loadEligibleBatches(): void {

    if (
      !this.program ||
      !this.semester ||
      !this.department ||
      !this.selectedAcademicSessionStartYear
    ) {

      return;

    }


    this.loadingBatches = true;

    this.batchError = '';


    this.batchService
      .getEligibleBatches(
        this.program,
        Number(this.semester),
        this.department,
        Number(
          this.selectedAcademicSessionStartYear
        )
      )
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          this.eligibleBatches =
            Array.isArray(response?.batches)
              ? response.batches
              : [];


          this.filteredBatches =
            [...this.eligibleBatches];


          this.loadingBatches = false;


          /*
           * Check lunch configuration for every batch.
           */
          this.eligibleBatches.forEach(
            (batch: any) => {

              this.checkBatchLunch(batch);

            }
          );


          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load eligible batches:',
            error
          );


          this.eligibleBatches = [];

          this.filteredBatches = [];

          this.loadingBatches = false;


          this.batchError =
            'Unable to load eligible batches.';


          this.cdr.detectChanges();

        }

      });

  }


  // ==================================================
  // BATCH SEARCH
  // ==================================================

  searchBatches(): void {

    const searchText =
      this.batchSearch
        .trim()
        .toLowerCase();


    if (!searchText) {

      this.filteredBatches =
        [...this.eligibleBatches];

      return;

    }


    this.filteredBatches =
      this.eligibleBatches.filter(
        (batch: any) => {

          const batchCode =
            String(
              batch.batch_code || ''
            ).toLowerCase();


          const program =
            String(
              batch.program || ''
            ).toLowerCase();


          const batchType =
            String(
              batch.batch_type || ''
            ).toLowerCase();


          const enrollmentYear =
            String(
              batch.enrollment_year || ''
            ).toLowerCase();


          const department =
            String(
              batch.department || ''
            ).toLowerCase();


          return (
            batchCode.includes(searchText) ||
            program.includes(searchText) ||
            batchType.includes(searchText) ||
            enrollmentYear.includes(searchText) ||
            department.includes(searchText)
          );

        }
      );

  }


  // ==================================================
  // CHECK BATCH LUNCH
  // ==================================================

  checkBatchLunch(batch: any): void {

    if (
      !this.selectedAcademicSessionStartYear ||
      !batch?.id
    ) {

      batch.lunchLocked = false;

      return;

    }


    this.batchService
      .getLunchForBatch(
        Number(batch.id),
        Number(
          this.selectedAcademicSessionStartYear
        )
      )
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          batch.lunchLocked =
            response?.locked === true;


          const configurations =
            Array.isArray(
              response?.configuration
            )
              ? response.configuration
              : [];


          const config =
            configurations[0];


          batch.lunchStart =
            config?.lunchStart ||
            config?.lunch_start ||
            '';


          batch.lunchEnd =
            config?.lunchEnd ||
            config?.lunch_end ||
            '';


          batch.lunchSource =
            response?.lunchSource ||
            null;


          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            `Failed to check lunch for batch ${batch.id}:`,
            error
          );


          batch.lunchLocked = false;

          batch.lunchStart = '';

          batch.lunchEnd = '';

          batch.lunchSource = null;


          this.cdr.detectChanges();

        }

      });

  }


  // ==================================================
  // BATCH SELECTED?
  // ==================================================

  isBatchSelected(batch: Batch): boolean {

    return this.selectedBatches.some(
      selectedBatch =>
        Number(selectedBatch.id) ===
        Number(batch.id)
    );

  }

  addTemporaryLock(
  resourceType: string,
  resourceId: number
): void {

  if (
    resourceType === 'room'
  ) {

    this.temporaryRoomIds.add(
      Number(resourceId)
    );

  }


  if (
    resourceType === 'faculty'
  ) {

    this.temporaryFacultyIds.add(
      Number(resourceId)
    );

  }


  if (
    resourceType === 'batch'
  ) {

    this.temporaryBatchIds.add(
      Number(resourceId)
    );

  }

}

removeTemporaryLock(
  resourceType: string,
  resourceId: number
): void {

  if (
    resourceType === 'room'
  ) {

    this.temporaryRoomIds.delete(
      Number(resourceId)
    );

  }


  if (
    resourceType === 'faculty'
  ) {

    this.temporaryFacultyIds.delete(
      Number(resourceId)
    );

  }


  if (
    resourceType === 'batch'
  ) {

    this.temporaryBatchIds.delete(
      Number(resourceId)
    );

  }

}

clearTemporaryLocks(): void {

  this.temporaryRoomIds.clear();

  this.temporaryFacultyIds.clear();

  this.temporaryBatchIds.clear();

}

  // ==================================================
  // BATCH LUNCH LOCK
  // ==================================================

  isBatchLunchLocked(batch: any): boolean {

    if (!batch?.lunchLocked) {

      return false;

    }


    const slotStart =
      this.selectedCell?.slot?.start ||
      this.selectedCell?.startTime ||
      this.selectedCell?.start ||
      '';


    const slotEnd =
      this.selectedCell?.slot?.end ||
      this.selectedCell?.endTime ||
      this.selectedCell?.end ||
      '';


    if (!slotStart || !slotEnd) {

      return false;

    }


    const toMinutes =
      (time: string): number => {

        const parts =
          time.split(':').map(Number);

        return (
          parts[0] * 60 +
          parts[1]
        );

      };


    const lunchStart =
      toMinutes(batch.lunchStart);

    const lunchEnd =
      toMinutes(batch.lunchEnd);


    const slotStartMinutes =
      toMinutes(slotStart);

    const slotEndMinutes =
      toMinutes(slotEnd);


    return (
      slotStartMinutes < lunchEnd &&
      slotEndMinutes > lunchStart
    );

  }


  isBatchAlreadyScheduled(batch: any): boolean {

    if (!batch?.id) {
      return false;
    }

    return this.lockedBatchIds.has(
      Number(batch.id)
    );
  }

  isBatchInUse(batch: any): boolean {

    if (!batch?.id) {
      return false;
    }

    return this.temporaryBatchIds.has(
      Number(batch.id)
    );
  }
  // ==================================================
  // BATCH REAL-TIME LOCK
  // ==================================================

  isBatchLocked(batch: any): boolean {

    if (!batch?.id) {

      return false;

    }


  return (
    this.lockedBatchIds.has(
      Number(batch.id)
    )
    ||
    this.temporaryBatchIds.has(
      Number(batch.id)
    )
  );

  }

  // ==================================================
  // TOGGLE BATCH
  // ==================================================

  toggleBatch(batch: any): void {

    if (
      !this.isBatchSelected(batch) &&
      this.isBatchLocked(batch)
    ) {

      console.warn(
        'Batch already scheduled:',
        batch.batch_code
      );

      return;

    }
    if (
      !this.isBatchSelected(batch) &&
      this.isBatchLunchLocked(batch)
    ) {

      console.warn(
        'Batch is unavailable because of lunch:',
        batch.batch_code
      );

      return;

    }


    const alreadySelected =
      this.isBatchSelected(batch);


if (alreadySelected) {

  this.selectedBatches =
    this.selectedBatches.filter(
      (selectedBatch: any) =>
        Number(selectedBatch.id) !==
        Number(batch.id)
    );


  // RELEASE TEMPORARY RESERVATION
  this.releaseResource(
    'batch',
    Number(batch.id)
  );

} else {

  this.selectedBatches = [
    ...this.selectedBatches,
    batch
  ];


  // TEMPORARY REAL-TIME RESERVATION
  this.reserveResource(
    'batch',
    Number(batch.id)
  );

}

    this.timetableSocketService.activity();

    this.calculateStudents();

    this.filterRooms();

    if (
      this.selectedRoom &&
      (
        this.isRoomLocked(this.selectedRoom) ||
        (
          this.totalStudents > 0 &&
          Number(
            this.selectedRoom.capacity || 0
          ) < this.totalStudents
        )
      )
    ) {

      this.selectedRoom = null;

    }


    this.cdr.detectChanges();

  }

  private reserveResource(
  resourceType: string,
  resourceId: number
): void {

  if (
    !this.selectedAcademicSessionId ||
    !this.selectedCell?.day ||
    !this.selectedCell?.slot?.id
  ) {

    return;

  }


  this.timetableSocketService.reserveResource(

    Number(
      this.selectedAcademicSessionId
    ),

    this.selectedCell.day,

    Number(
      this.selectedCell.slot.id
    ),

    resourceType,

    Number(resourceId)

  );

}


  // ==================================================
  // BATCH DROPDOWN
  // ==================================================

  toggleBatchDropdown(): void {

    this.isBatchDropdownOpen =
      !this.isBatchDropdownOpen;

  }


  private releaseResource(
  resourceType: string,
  resourceId: number
): void {

  if (
    !this.selectedAcademicSessionId ||
    !this.selectedCell?.day ||
    !this.selectedCell?.slot?.id
  ) {

    return;

  }


  this.timetableSocketService.releaseResource(

    Number(
      this.selectedAcademicSessionId
    ),

    this.selectedCell.day,

    Number(
      this.selectedCell.slot.id
    ),

    resourceType,

    Number(resourceId)

  );

}

  // ==================================================
  // CALCULATE STUDENTS
  // ==================================================

  calculateStudents(): void {

    /*
     * Current project assumption:
     * every batch contains 30 students.
     */
    this.totalStudents =
      this.selectedBatches.length * 30;

  }


  // ==================================================
  // LOAD FACULTY
  // ==================================================

  loadFaculty(): void {

    this.loadingFaculty = true;


    this.facultyService
      .getFaculty()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          if (Array.isArray(response)) {

            this.teachers = response;

          } else if (
            Array.isArray(response?.faculty)
          ) {

            this.teachers =
              response.faculty;

          } else if (
            Array.isArray(response?.data)
          ) {

            this.teachers =
              response.data;

          } else {

            this.teachers = [];

          }


          this.loadingFaculty = false;


          this.sortFaculty();


          this.filteredTeachers =
            [...this.teachers];


          this.cdr.detectChanges();

        },

        error: (error) => {

          this.loadingFaculty = false;

          this.teachers = [];

          this.filteredTeachers = [];


          console.error(
            'Failed to load faculty:',
            error
          );

        }

      });

  }


  // ==================================================
  // SORT FACULTY
  // ==================================================

  sortFaculty(): void {

    const currentDepartment =
      this.department
        ?.trim()
        .toLowerCase();


    if (!currentDepartment) {

      this.teachers.sort(
        (a, b) =>
          String(a.name || '')
            .localeCompare(
              String(b.name || '')
            )
      );

      return;

    }


    this.teachers.sort(
      (a, b) => {

        const aDepartment =
          String(
            a.department || ''
          )
            .trim()
            .toLowerCase();


        const bDepartment =
          String(
            b.department || ''
          )
            .trim()
            .toLowerCase();


        const aCurrent =
          aDepartment ===
          currentDepartment;


        const bCurrent =
          bDepartment ===
          currentDepartment;


        if (
          aCurrent &&
          !bCurrent
        ) {

          return -1;

        }


        if (
          !aCurrent &&
          bCurrent
        ) {

          return 1;

        }


        return String(
          a.name || ''
        ).localeCompare(
          String(
            b.name || ''
          )
        );

      }
    );

  }


  // ==================================================
  // FACULTY SEARCH
  // ==================================================

  searchFaculty(): void {

    const search =
      this.teacherSearch
        .trim()
        .toLowerCase();


    if (!search) {

      this.filteredTeachers =
        [...this.teachers];

      return;

    }


    this.filteredTeachers =
      this.teachers.filter(
        (teacher: any) => {

          const name =
            String(
              teacher.name || ''
            ).toLowerCase();


          const abbreviation =
            String(
              teacher.abbreviation || ''
            ).toLowerCase();


          return (
            name.includes(search) ||
            abbreviation.includes(search)
          );

        }
      );

  }


  // ==================================================
  // FACULTY SELECTED?
  // ==================================================

  isFacultySelected(
    teacher: any
  ): boolean {

    return this.selectedTeachers.some(
      t =>
        Number(t.id) ===
        Number(teacher.id)
    );

  }


  // ==================================================
  // FACULTY REAL-TIME LOCK
  // ==================================================


  isFacultyAlreadyTeaching(teacher: any): boolean {

  if (!teacher?.id) {
    return false;
  }

  return this.lockedFacultyIds.has(
    Number(teacher.id)
  );
}


isFacultyInUse(teacher: any): boolean {

  if (!teacher?.id) {
    return false;
  }

  return this.temporaryFacultyIds.has(
    Number(teacher.id)
  );
}


isFacultyLocked(teacher: any): boolean {

  if (!teacher?.id) {
    return false;
  }

  return (
    this.lockedFacultyIds.has(
      Number(teacher.id)
    )
    ||
    this.temporaryFacultyIds.has(
      Number(teacher.id)
    )
  );
}

  // ==================================================
  // TOGGLE FACULTY
  // ==================================================

  toggleFaculty(
    teacher: any
  ): void {

    /*
     * Do not allow a faculty member who is already
     * teaching another class at this exact time.
     */
    if (
      !this.isFacultySelected(teacher) &&
      this.isFacultyLocked(teacher)
    ) {

      console.warn(
        'Faculty already teaching:',
        teacher.name
      );

      return;

    }


    const exists =
      this.isFacultySelected(teacher);


if (exists) {

  this.selectedTeachers =
    this.selectedTeachers.filter(
      t =>
        Number(t.id) !==
        Number(teacher.id)
    );


  this.releaseResource(
    'faculty',
    Number(teacher.id)
  );

} else {

  this.selectedTeachers.push(
    teacher
  );


  this.reserveResource(
    'faculty',
    Number(teacher.id)
  );

}

  this.timetableSocketService.activity();

  }


  // ==================================================
  // FACULTY DROPDOWN
  // ==================================================

  toggleFacultyDropdown(): void {

    this.isTeacherDropdownOpen =
      !this.isTeacherDropdownOpen;

  }


  // ==================================================
  // LOAD ROOMS
  // ==================================================

  loadRooms(): void {

    this.loadingRooms = true;


    this.roomService
      .getRooms()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          if (Array.isArray(response)) {

            this.rooms = response;

          } else if (
            Array.isArray(response?.rooms)
          ) {

            this.rooms =
              response.rooms;

          } else if (
            Array.isArray(response?.data)
          ) {

            this.rooms =
              response.data;

          } else {

            this.rooms = [];

          }


          this.loadingRooms = false;


          this.filterRooms();

          this.filterRoomsBySearch();


          this.cdr.detectChanges();

        },

        error: (error) => {

          this.loadingRooms = false;

          this.rooms = [];

          this.availableRooms = [];

          this.filteredRooms = [];


          console.error(
            'Failed to load rooms:',
            error
          );

        }

      });

  }


  // ==================================================
  // LECTURE TYPE CHANGE
  // ==================================================

onLectureTypeChange(): void {

  // Clear room selection because room type may change
  this.selectedRoom = null;

  this.roomSearch = '';

  this.roomDropdownOpen = false;

  // Refresh rooms
  this.filterRooms();

  // Refresh subjects according to L/T/P
  this.filterSubjects();
}


  // ==================================================
  // FILTER ROOMS
  // ==================================================

  filterRooms(): void {

    if (!this.rooms.length) {

      this.availableRooms = [];

      this.filteredRooms = [];

      return;

    }


    const selectedType =
      String(
        this.lectureType || ''
      )
        .trim()
        .toUpperCase();


    this.availableRooms =
      [...this.rooms];


    this.availableRooms.sort(
      (a, b) => {

        const aType =
          String(
            a.room_type || ''
          )
            .trim()
            .toUpperCase();


        const bType =
          String(
            b.room_type || ''
          )
            .trim()
            .toUpperCase();


        const aCapacity =
          Number(
            a.capacity || 0
          );


        const bCapacity =
          Number(
            b.capacity || 0
          );


        const aTypeMatch =
          aType === selectedType;


        const bTypeMatch =
          bType === selectedType;


        const aCapacityEnough =
          aCapacity >=
          this.totalStudents;


        const bCapacityEnough =
          bCapacity >=
          this.totalStudents;


        const getPriority =
          (
            typeMatch: boolean,
            capacityEnough: boolean
          ): number => {

            if (
              typeMatch &&
              capacityEnough
            ) {

              return 1;

            }


            if (
              typeMatch &&
              !capacityEnough
            ) {

              return 2;

            }


            if (
              !typeMatch &&
              capacityEnough
            ) {

              return 3;

            }


            return 4;

          };


        const aPriority =
          getPriority(
            aTypeMatch,
            aCapacityEnough
          );


        const bPriority =
          getPriority(
            bTypeMatch,
            bCapacityEnough
          );


        if (
          aPriority !==
          bPriority
        ) {

          return (
            aPriority -
            bPriority
          );

        }


        if (
          aCapacityEnough &&
          bCapacityEnough
        ) {

          return (
            aCapacity -
            bCapacity
          );

        }


        return (
          bCapacity -
          aCapacity
        );

      }
    );


    this.filterRoomsBySearch();

  }


  // ==================================================
  // ROOM REAL-TIME LOCK
  // ==================================================


  isRoomAlreadyScheduled(room: any): boolean {

  if (!room?.id) {
    return false;
  }

  return this.lockedRoomIds.has(
    Number(room.id)
  );
}


isRoomInUse(room: any): boolean {

  if (!room?.id) {
    return false;
  }

  return this.temporaryRoomIds.has(
    Number(room.id)
  );
}


isRoomLocked(room: any): boolean {

  if (!room?.id) {
    return false;
  }

  return (
    this.lockedRoomIds.has(
      Number(room.id)
    )
    ||
    this.temporaryRoomIds.has(
      Number(room.id)
    )
  );
}

  // ==================================================
  // ROOM SELECTION
  // ==================================================

  selectRoom(
    room: any
  ): void {

    /*
     * Already being used by another coordinator.
     */
    if (
      this.isRoomLocked(room)
    ) {

      console.warn(
        'Room already in use:',
        room.room_id
      );

      return;

    }


    // Capacity validation.

    if (
      this.totalStudents > 0 &&
      Number(
        room.capacity || 0
      ) < this.totalStudents
    ) {

      return;

    }

    if (
    this.selectedRoom &&
    Number(this.selectedRoom.id) !==
    Number(room.id)
  ) {

  this.releaseResource(
    'room',
    Number(this.selectedRoom.id)
  );

}


    this.selectedRoom = room;

    this.reserveResource( 'room',Number(room.id) );

    this.timetableSocketService.activity();

    this.roomDropdownOpen = false;

    this.roomSearch = '';

    this.filterRoomsBySearch();

  }


  // ==================================================
  // ROOM SEARCH
  // ==================================================

  filterRoomsBySearch(): void {

    const search =
      this.roomSearch
        .trim()
        .toLowerCase();


    if (!search) {

      this.filteredRooms =
        [...this.availableRooms];

      return;

    }


    this.filteredRooms =
      this.availableRooms.filter(
        (room: any) => {

          const roomId =
            String(
              room.room_id || ''
            ).toLowerCase();


          const roomName =
            String(
              room.room_name || ''
            ).toLowerCase();


          const roomType =
            String(
              room.room_type || ''
            ).toLowerCase();


          return (
            roomId.includes(search) ||
            roomName.includes(search) ||
            roomType.includes(search)
          );

        }
      );

  }

  filterSubjects(): void {

  const selectedType =
    String(this.lectureType || '')
      .trim()
      .toUpperCase();

  let subjects = [...this.subjects];

  switch (selectedType) {

    case 'L':

      subjects = subjects.filter(
        (subject: any) =>
          Number(subject.lecture_hours || 0) > 0
      );

      break;


    case 'T':

      subjects = subjects.filter(
        (subject: any) =>
          Number(subject.tutorial_hours || 0) > 0
      );

      break;


    case 'P':

      subjects = subjects.filter(
        (subject: any) =>
          Number(subject.practical_hours || 0) > 0
      );

      break;

  }


  // Apply search after L/T/P filtering
  const search =
    this.subjectSearch
      .trim()
      .toLowerCase();


  if (search) {

    subjects =
      subjects.filter(
        (subject: any) => {

          const code =
            String(
              subject.course_code || ''
            ).toLowerCase();

          const name =
            String(
              subject.subject_name || ''
            ).toLowerCase();

          return (
            code.includes(search) ||
            name.includes(search)
          );

        }
      );

  }


  this.filteredSubjects = subjects;

  this.cdr.detectChanges();

}
  // ==================================================
  // LOAD SUBJECTS
  // ==================================================

  loadSubjects(): void {

    if (
      !this.program ||
      !this.semester ||
      !this.department
    ) {

      this.subjects = [];

      this.filteredSubjects = [];

      return;

    }


    this.subjectService
      .getSubjects(
        this.program,
        this.department,
        Number(this.semester)
      )
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          if (Array.isArray(response)) {

            this.subjects =
              response;

          } else if (
            Array.isArray(
              response?.subjects
            )
          ) {

            this.subjects =
              response.subjects;

          } else if (
            Array.isArray(
              response?.data
            )
          ) {

            this.subjects =
              response.data;

          } else {

            this.subjects = [];

          }


          this.filterSubjectsByLectureType();


          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load subjects:',
            error
          );


          this.subjects = [];

          this.filteredSubjects = [];


          this.cdr.detectChanges();

        }

      });

  }


  // ==================================================
  // PROGRAM CODE
  // ==================================================

  getProgramCode(): string {

    const value =
      String(
        this.program
      )
        .trim()
        .toUpperCase();


    if (
      value === 'BTECH' ||
      value === 'MTECH'
    ) {

      return value;

    }


    if (value === '1') {

      return 'BTECH';

    }


    if (value === '2') {

      return 'MTECH';

    }


    return value;

  }


  // ==================================================
  // SUBJECT DROPDOWN
  // ==================================================

  toggleSubjectDropdown(): void {

    this.isSubjectDropdownOpen =
      !this.isSubjectDropdownOpen;


    if (
      this.isSubjectDropdownOpen
    ) {

      this.subjectSearch = '';

      this.filterSubjects();


    }

  }


  // ==================================================
  // SUBJECT SEARCH
  // ==================================================

searchSubjects(): void {
  this.filterSubjects();
}
// ==================================================
// FILTER SUBJECTS BY LECTURE TYPE
// ==================================================

filterSubjectsByLectureType(): void {

  const selectedType =
    String(this.lectureType || '')
      .trim()
      .toUpperCase();

  this.filteredSubjects =
    this.subjects.filter((subject: any) => {

      /*
       * Change these field names if your API uses
       * a different property for L/T/P.
       */

      const subjectType =
        String(
          subject.lecture_type ||
          subject.lectureType ||
          subject.type ||
          subject.types ||
          ''
        )
          .trim()
          .toUpperCase();

      /*
       * Example:
       *
       * subjectType = "L,T"
       *  -> visible for L and T
       *
       * subjectType = "P"
       *  -> visible only for P
       *
       * subjectType = "L"
       *  -> visible only for L
       */

      const types =
        subjectType
          .split(',')
          .map((type: string) =>
            type.trim()
          )
          .filter(Boolean);

      return types.includes(selectedType);

    });

}

  // ==================================================
  // SELECT SUBJECT
  // ==================================================

  selectSubject(
    subject: any
  ): void {

    this.selectedSubject =
      subject;

    this.timetableSocketService.activity();
    this.isSubjectDropdownOpen =
      false;


    this.subjectSearch = '';


    this.filteredSubjects =
      [...this.subjects];


    this.cdr.detectChanges();

  }


  // ==================================================
  // LOCK HELPERS
  // ==================================================

  addLock(
    resource: any
  ): void {

    if (
      resource.type === 'room'
    ) {

      this.lockedRoomIds.add(
        Number(resource.id)
      );

    }


    if (
      resource.type === 'faculty'
    ) {

      this.lockedFacultyIds.add(
        Number(resource.id)
      );

    }


    if (
      resource.type === 'batch'
    ) {

      this.lockedBatchIds.add(
        Number(resource.id)
      );

    }

  }


  removeLock(
    resource: any
  ): void {

    if (
      resource.type === 'room'
    ) {

      this.lockedRoomIds.delete(
        Number(resource.id)
      );

    }


    if (
      resource.type === 'faculty'
    ) {

      this.lockedFacultyIds.delete(
        Number(resource.id)
      );

    }


    if (
      resource.type === 'batch'
    ) {

      this.lockedBatchIds.delete(
        Number(resource.id)
      );

    }

  }


  // ==================================================
  // CLEAR LOCKS
  // ==================================================

  clearLockedResources(): void {

    this.lockedRoomIds =
      new Set<number>();


    this.lockedFacultyIds =
      new Set<number>();


    this.lockedBatchIds =
      new Set<number>();

  }


  // ==================================================
  // LOAD LOCKED RESOURCES
  // ==================================================

  loadLockedResources(): void {

    if (
      !this.selectedAcademicSessionId ||
      !this.selectedCell?.day ||
      !this.selectedCell?.slot?.id
    ) {

      return;

    }


    const day =
      this.selectedCell.day;


    const slotId =
      Number(
        this.selectedCell.slot.id
      );


    this.timetableService
      .getLockedResources(
        Number(
          this.selectedAcademicSessionId
        ),
        day,
        slotId
      )
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (response: any) => {

          console.log(
            'LOCKED RESOURCES:',
            response
          );


          this.lockedRoomIds =
            new Set<number>(
              Array.isArray(
                response?.roomIds
              )
                ? response.roomIds.map(
                    (id: any) =>
                      Number(id)
                  )
                : []
            );


          this.lockedFacultyIds =
            new Set<number>(
              Array.isArray(
                response?.facultyIds
              )
                ? response.facultyIds.map(
                    (id: any) =>
                      Number(id)
                  )
                : []
            );


          this.lockedBatchIds =
            new Set<number>(
              Array.isArray(
                response?.batchIds
              )
                ? response.batchIds.map(
                    (id: any) =>
                      Number(id)
                  )
                : []
            );


          /*
           * If the currently selected room has become
           * locked while this editor was open, remove it.
           */
          if (
            this.selectedRoom &&
            this.isRoomLocked(
              this.selectedRoom
            )
          ) {

            this.selectedRoom = null;

          }


          /*
           * Remove teachers that became unavailable.
           *
           * This is optional visually, but it prevents an
           * already-selected teacher from remaining selected.
           */
          this.selectedTeachers =
            this.selectedTeachers.filter(
              teacher =>
                !this.isFacultyLocked(
                  teacher
                )
            );


          /*
           * Remove batches that became unavailable.
           */
          this.selectedBatches =
            this.selectedBatches.filter(
              batch =>
                !this.isBatchLocked(
                  batch
                )
            );


          this.calculateStudents();

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load locked resources:',
            error
          );

        }

      });

  }


  // ==================================================
  // JOIN TIMETABLE CELL
  // ==================================================

  private joinedCell: {
  academicSessionId: number;
  day: string;
  slotId: number;
} | null = null;

joinTimetableCell(): void {

  if (
    !this.selectedAcademicSessionId ||
    !this.selectedCell?.day ||
    !this.selectedCell?.slot?.id
  ) {
    return;
  }

  const sessionId =
    Number(this.selectedAcademicSessionId);

  const day =
    this.selectedCell.day;

  const slotId =
    Number(this.selectedCell.slot.id);


  // Leave previous room
  if (this.joinedCell) {

    this.timetableSocketService.leaveCell(
      this.joinedCell.academicSessionId,
      this.joinedCell.day,
      this.joinedCell.slotId
    );

  }


  // Join new room
  this.timetableSocketService.joinCell(
    sessionId,
    day,
    slotId
  );


  this.joinedCell = {
    academicSessionId: sessionId,
    day,
    slotId
  };

}


  // ==================================================
  // SUBMIT
  // ==================================================

  submit(): void {

    // --------------------------------------------------
    // SESSION
    // --------------------------------------------------

    if (
      !this.selectedAcademicSessionId
    ) {

      alert(
        'Timetable creation is disabled because no academic session is active.'
      );

      return;

    }


    // --------------------------------------------------
    // BATCH
    // --------------------------------------------------

    if (
      this.selectedBatches.length === 0
    ) {

      alert(
        'Please select at least one batch.'
      );

      return;

    }


    // --------------------------------------------------
    // SUBJECT
    // --------------------------------------------------

    if (
      !this.selectedSubject
    ) {

      alert(
        'Please select a subject.'
      );

      return;

    }


    // --------------------------------------------------
    // ROOM
    // --------------------------------------------------

    if (
      !this.selectedRoom
    ) {

      alert(
        'Please select a room.'
      );

      return;

    }


    // --------------------------------------------------
    // ROOM LOCK RACE CONDITION
    // --------------------------------------------------

    if (
      this.isRoomLocked(
        this.selectedRoom
      )
    ) {

      alert(
        'The selected room has just been occupied by another timetable. Please select another room.'
      );

      this.selectedRoom = null;

      return;

    }


    // --------------------------------------------------
    // FACULTY
    // --------------------------------------------------

    if (
      this.selectedTeachers.length === 0
    ) {

      alert(
        'Please select at least one teacher.'
      );

      return;

    }


    // --------------------------------------------------
    // FACULTY LOCK RACE CONDITION
    // --------------------------------------------------

    const lockedTeacher =
      this.selectedTeachers.find(
        teacher =>
          this.isFacultyLocked(
            teacher
          )
      );


    if (lockedTeacher) {

      alert(
        `${lockedTeacher.name} has just been assigned to another class at this time. Please select another teacher.`
      );

      return;

    }


    // --------------------------------------------------
    // BATCH LOCK RACE CONDITION
    // --------------------------------------------------

    const lockedBatch =
      this.selectedBatches.find(
        batch =>
          this.isBatchLocked(
            batch
          )
      );


    if (lockedBatch) {

      alert(
        `${lockedBatch.batch_code} has just been assigned to another class at this time. Please select another batch.`
      );

      return;

    }


    // --------------------------------------------------
    // CAPACITY
    // --------------------------------------------------

    if (
      this.totalStudents > 0 &&
      Number(
        this.selectedRoom.capacity || 0
      ) < this.totalStudents
    ) {

      alert(
        'The selected room does not have enough capacity for the selected batches.'
      );

      return;

    }


    // --------------------------------------------------
    // CREATE DATA
    // --------------------------------------------------

    const data = {

      // Academic session
      academicSessionId:
        Number(
          this.selectedAcademicSessionId
        ),


      // Program
      programId:
        Number(
          this.selectedSubject.program_id
        ),


      // Department
      departmentId:
        Number(
          this.selectedSubject.department_id
        ),


      // Semester
      semesterId:
        Number(
          this.selectedSubject.semester_id
        ),


      // Timetable position
      day:
        this.selectedCell?.day,


      slotId:
        Number(
          this.selectedCell?.slot?.id
        ),


      startTime:
        this.selectedCell?.slot?.start,


      endTime:
        this.selectedCell?.slot?.end,


      // Subject
      subjectId:
        Number(
          this.selectedSubject.id
        ),


      subjectCode:
        this.selectedSubject.course_code,


      subjectName:
        this.selectedSubject.subject_name,


      // Lecture type
      lectureType:
        this.lectureType,


      // Room
      roomId:
        Number(
          this.selectedRoom.id
        ),


      room:
        this.selectedRoom.room_id,


      roomName:
        this.selectedRoom.room_name,


      roomType:
        this.selectedRoom.room_type,


      roomCapacity:
        Number(
          this.selectedRoom.capacity
        ),


      // Batches
      batches:
        this.selectedBatches,


      batchIds:
        this.selectedBatches.map(
          batch =>
            Number(batch.id)
        ),


      // Faculty
      teachers:
        this.selectedTeachers,


      teacherIds:
        this.selectedTeachers.map(
          teacher =>
            Number(teacher.id)
        ),


      // Students
      totalStudents:
        Number(
          this.totalStudents
        )

    };


    console.log(
      'SUBMIT TIMETABLE ENTRY:',
      data
    );


    this.save.emit(data);

  }


  // ==================================================
  // CANCEL
  // ==================================================

close(): void {

  this.releaseAllTemporaryResources();

  this.cancel.emit();

}

private releaseAllTemporaryResources(): void {

  // ------------------------------------------
  // BATCHES
  // ------------------------------------------

  for (
    const batch
    of this.selectedBatches
  ) {

    this.releaseResource(
      'batch',
      Number(batch.id)
    );

  }


  // ------------------------------------------
  // FACULTY
  // ------------------------------------------

  for (
    const teacher
    of this.selectedTeachers
  ) {

    this.releaseResource(
      'faculty',
      Number(teacher.id)
    );

  }


  // ------------------------------------------
  // ROOM
  // ------------------------------------------

  if (
    this.selectedRoom
  ) {

    this.releaseResource(
      'room',
      Number(
        this.selectedRoom.id
      )
    );

  }

}


  // ==================================================
  // DESTROY
  // ==================================================
ngOnDestroy(): void {

  if (
    this.heartbeatTimer
  ) {

    clearInterval(
      this.heartbeatTimer
    );

  }


  this.destroy$.next();

  this.destroy$.complete();

}

}