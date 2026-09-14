import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectorRef,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { FacultyService } from '../../../services/faculty';
import { RoomService } from '../../../services/room';

import {
  BatchService,
  Batch
} from '../../../services/batch';

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
export class ClassEditor implements OnInit, OnChanges {

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
  academicSessionStartYear = 0;

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
  // FACULTY SEARCH
  // ==================================================

  teacherSearch = '';

  filteredTeachers: any[] = [];

  // ==================================================
  // SELECTED DATA
  // ==================================================

  selectedSubject: any = null;

  selectedTeachers: any[] = [];

  selectedRoom: any = null;

  // ==================================================
  // ROOM DROPDOWN
  // ==================================================

  roomDropdownOpen = false;

  roomSearch = '';

  filteredRooms: any[] = [];

  // ==================================================
  // AVAILABLE ROOMS
  // ==================================================

  availableRooms: any[] = [];

  // ==================================================
  // BATCH DATA
  // ==================================================

  batches: Batch[] = [];

  selectedBatches: Batch[] = [];

  loadingBatches = false;

  batchError = '';

  totalStudents = 0;

  private lastBatchRequestKey = '';

  // ==================================================
  // LOADING
  // ==================================================

  loadingFaculty = false;

  loadingRooms = false;

  // ==================================================
  // CONSTRUCTOR
  // ==================================================

  constructor(
    private facultyService: FacultyService,
    private roomService: RoomService,
    private batchService: BatchService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================================================
  // INPUT CHANGES
  // ==================================================

  ngOnInit(): void {
  console.log('ClassEditor initialized');

  console.log('Received inputs:', {
    program: this.program,
    semester: this.semester,
    academicSessionStartYear: this.academicSessionStartYear,
    department: this.department
  });

  // Load master data
  this.loadFaculty();
  this.loadRooms();

  // Load batches if all required inputs are already available
  this.loadEligibleBatches();
}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['program'] ||
      changes['semester'] ||
      changes['academicSessionStartYear']
    ) {
      this.loadEligibleBatches();
    }

    if (changes['department']) {
      this.sortFaculty();

      this.filteredTeachers = [...this.teachers];
    }
  }

  // ==================================================
  // LOAD ELIGIBLE BATCHES
  // ==================================================

  loadEligibleBatches(): void {
    if (
      !this.program ||
      !this.semester ||
      !this.academicSessionStartYear
    ) {
      this.batches = [];
      this.selectedBatches = [];
      this.totalStudents = 0;
      this.lastBatchRequestKey = '';

      this.filterRooms();

      return;
    }

    const requestKey =
      `${this.program}-${this.semester}-${this.academicSessionStartYear}`;

    if (requestKey === this.lastBatchRequestKey) {
      return;
    }

    this.lastBatchRequestKey = requestKey;

    this.loadingBatches = true;
    this.batchError = '';

    this.batches = [];
    this.selectedBatches = [];
    this.totalStudents = 0;

    this.batchService
      .getEligibleBatches(
        this.program,
        this.semester,
        this.academicSessionStartYear
      )
      .subscribe({
        next: (response) => {
          this.batches = response.batches || [];
          this.loadingBatches = false;

          this.calculateStudents();
          this.filterRooms();
        },

        error: (error) => {
          console.error(
            'Failed to load eligible batches:',
            error
          );

          this.batches = [];
          this.selectedBatches = [];
          this.totalStudents = 0;

          this.loadingBatches = false;

          this.batchError =
            error?.error?.message ||
            'Failed to load eligible batches';

          this.filterRooms();
        }
      });
  }

  // ==================================================
  // BATCH SELECTION
  // ==================================================

  isBatchSelected(batch: Batch): boolean {
    return this.selectedBatches.some(
      selectedBatch => selectedBatch.id === batch.id
    );
  }

  onBatchChange(
    batch: Batch,
    event: Event
  ): void {
    const checkbox =
      event.target as HTMLInputElement;

    if (checkbox.checked) {
      if (!this.isBatchSelected(batch)) {
        this.selectedBatches.push(batch);
      }
    } else {
      this.selectedBatches =
        this.selectedBatches.filter(
          selectedBatch => selectedBatch.id !== batch.id
        );
    }

    this.calculateStudents();

    this.filterRooms();

    /*
     * Remove the selected room if it cannot
     * accommodate the selected students.
     */
    if (
      this.selectedRoom &&
      this.totalStudents > 0 &&
      Number(this.selectedRoom.capacity || 0) <
        this.totalStudents
    ) {
      this.selectedRoom = null;
    }
  }

  calculateStudents(): void {
    /*
     * Every batch contains exactly 30 students.
     */
    this.totalStudents =
      this.selectedBatches.length * 30;
  }

  getRequiredCapacity(): number {
    return this.selectedBatches.length * 30;
  }

  // ==================================================
  // LOAD FACULTY
  // ==================================================

loadFaculty(): void {
  this.loadingFaculty = true;

  this.facultyService.getFaculty().subscribe({
    next: (response: any) => {
      console.log('Faculty API response:', response);

      if (Array.isArray(response)) {
        this.teachers = response;
      } else if (Array.isArray(response?.faculty)) {
        this.teachers = response.faculty;
      } else if (Array.isArray(response?.data)) {
        this.teachers = response.data;
      } else {
        this.teachers = [];
      }

      console.log('Faculty count:', this.teachers.length);

      this.loadingFaculty = false;

      this.sortFaculty();
      this.filteredTeachers = [...this.teachers];

      this.cdr.detectChanges();
    },

    error: (error) => {
      this.loadingFaculty = false;
      this.teachers = [];
      this.filteredTeachers = [];

      console.error('Failed to load faculty:', error);
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
      this.teachers.sort((a, b) =>
        String(a.name || '').localeCompare(
          String(b.name || '')
        )
      );

      return;
    }

    this.teachers.sort((a, b) => {
      const aDepartment =
        String(a.department || '')
          .trim()
          .toLowerCase();

      const bDepartment =
        String(b.department || '')
          .trim()
          .toLowerCase();

      const aCurrent =
        aDepartment === currentDepartment;

      const bCurrent =
        bDepartment === currentDepartment;

      if (aCurrent && !bCurrent) {
        return -1;
      }

      if (!aCurrent && bCurrent) {
        return 1;
      }

      return String(a.name || '').localeCompare(
        String(b.name || '')
      );
    });
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
      this.filteredTeachers = [...this.teachers];
      return;
    }

    this.filteredTeachers =
      this.teachers.filter(teacher => {
        const name =
          String(teacher.name || '').toLowerCase();

        const abbreviation =
          String(teacher.abbreviation || '').toLowerCase();

        return (
          name.includes(search) ||
          abbreviation.includes(search)
        );
      });
  }

  // ==================================================
  // LOAD ROOMS
  // ==================================================

loadRooms(): void {
  this.loadingRooms = true;

  this.roomService.getRooms().subscribe({
    next: (response: any) => {
      console.log('Rooms API response:', response);

      if (Array.isArray(response)) {
        this.rooms = response;
      } else if (Array.isArray(response?.rooms)) {
        this.rooms = response.rooms;
      } else if (Array.isArray(response?.data)) {
        this.rooms = response.data;
      } else {
        this.rooms = [];
      }

      console.log('Room count:', this.rooms.length);

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

      console.error('Failed to load rooms:', error);
    }
  });
}

  // ==================================================
  // LECTURE TYPE CHANGE
  // ==================================================

  onLectureTypeChange(): void {
    this.selectedRoom = null;

    this.roomSearch = '';

    this.roomDropdownOpen = false;

    this.filterRooms();
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
      String(this.lectureType || '')
        .trim()
        .toUpperCase();

    this.availableRooms = [...this.rooms];

    this.availableRooms.sort((a, b) => {
      const aType =
        String(a.room_type || '')
          .trim()
          .toUpperCase();

      const bType =
        String(b.room_type || '')
          .trim()
          .toUpperCase();

      const aCapacity =
        Number(a.capacity || 0);

      const bCapacity =
        Number(b.capacity || 0);

      const aTypeMatch =
        aType === selectedType;

      const bTypeMatch =
        bType === selectedType;

      const aCapacityEnough =
        aCapacity >= this.totalStudents;

      const bCapacityEnough =
        bCapacity >= this.totalStudents;

      const getPriority = (
        typeMatch: boolean,
        capacityEnough: boolean
      ): number => {
        if (typeMatch && capacityEnough) {
          return 1;
        }

        if (typeMatch && !capacityEnough) {
          return 2;
        }

        if (!typeMatch && capacityEnough) {
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

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      /*
       * Smaller suitable room first.
       */
      if (
        aCapacityEnough &&
        bCapacityEnough
      ) {
        return aCapacity - bCapacity;
      }

      /*
       * Larger insufficient room first.
       */
      return bCapacity - aCapacity;
    });

    this.filterRoomsBySearch();
  }

  // ==================================================
  // ROOM SELECTION
  // ==================================================

  selectRoom(room: any): void {
    /*
     * Do not select a room with insufficient capacity.
     */
    if (
      this.totalStudents > 0 &&
      Number(room.capacity || 0) < this.totalStudents
    ) {
      return;
    }

    this.selectedRoom = room;

    this.roomDropdownOpen = false;

    this.roomSearch = '';

    this.filterRoomsBySearch();
  }

  // ==================================================
  // FILTER ROOMS BY SEARCH
  // ==================================================

  filterRoomsBySearch(): void {
    const search =
      this.roomSearch
        .trim()
        .toLowerCase();

    if (!search) {
      this.filteredRooms = [...this.availableRooms];
      return;
    }

    this.filteredRooms =
      this.availableRooms.filter(room => {
        const roomId =
          String(room.room_id || '').toLowerCase();

        const roomName =
          String(room.room_name || '').toLowerCase();

        const roomType =
          String(room.room_type || '').toLowerCase();

        return (
          roomId.includes(search) ||
          roomName.includes(search) ||
          roomType.includes(search)
        );
      });
  }

  // ==================================================
  // TEACHER SELECTION
  // ==================================================

  toggleTeacher(teacher: any): void {
    const exists =
      this.selectedTeachers.some(
        t => t.id === teacher.id
      );

    if (exists) {
      this.selectedTeachers =
        this.selectedTeachers.filter(
          t => t.id !== teacher.id
        );
    } else {
      this.selectedTeachers.push(teacher);
    }
  }

  // ==================================================
  // CHECK TEACHER
  // ==================================================

  isTeacherSelected(teacher: any): boolean {
    return this.selectedTeachers.some(
      t => t.id === teacher.id
    );
  }

  // ==================================================
  // SUBMIT
  // ==================================================

  submit(): void {
    const selectedBatches = this.selectedBatches;

    if (selectedBatches.length === 0) {
      alert('Please select at least one batch.');
      return;
    }

    if (!this.selectedSubject) {
      alert('Please select a subject.');
      return;
    }

    if (!this.selectedRoom) {
      alert('Please select a room.');
      return;
    }

    const data = {
      lectureType: this.lectureType,

      batches: selectedBatches,

      subjectCode: this.selectedSubject.code,

      subjectName: this.selectedSubject.name,

      room: this.selectedRoom.room_id,

      roomId: this.selectedRoom.id,

      roomName: this.selectedRoom.room_name,

      roomType: this.selectedRoom.room_type,

      roomCapacity: this.selectedRoom.capacity,

      teachers: this.selectedTeachers,

      totalStudents: this.totalStudents
    };

    this.save.emit(data);
  }

  // ==================================================
  // CANCEL
  // ==================================================

  close(): void {
    this.cancel.emit();
  }
}