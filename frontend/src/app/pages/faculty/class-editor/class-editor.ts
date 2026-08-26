import {  Component,  EventEmitter,  Input,  Output,  OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacultyService } from '../../../services/faculty';
import { RoomService } from '../../../services/room';


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
export class ClassEditor implements OnInit {


  // ==================================================
  // INPUTS
  // ==================================================

  @Input()
  selectedCell: any;


  /*
   * Department of the timetable currently being created.
   *
   * Example:
   * CSE & IT
   */
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

  batches: any[] = [];

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


  // ==================================================
  // AVAILABLE ROOMS
  // ==================================================

  availableRooms: any[] = [];


  // ==================================================
  // STUDENT COUNT
  // ==================================================

  totalStudents = 0;


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
    private cdr: ChangeDetectorRef

  ) {}


  // ==================================================
  // INIT
  // ==================================================

  ngOnInit(): void {

    this.loadFaculty();

    this.loadRooms();

    /*
     * Keep your batches and subjects loading
     * separately when their APIs are ready.
     */
  }


  // ==================================================
  // LOAD FACULTY
  // ==================================================

  loadFaculty(): void {

    this.loadingFaculty = true;


    this.facultyService
      .getFaculty()
      .subscribe({

        next: (data: any[]) => {

          console.log(
            'Faculty loaded:',
            data
          );


          this.loadingFaculty = false;


          this.teachers = data || [];
          this.cdr.detectChanges();

          /*
           * Put faculty belonging to the
           * current department first.
           */

          this.sortFaculty();


          this.filteredTeachers =
            [...this.teachers];

        },


        error: (error) => {

          this.loadingFaculty = false;


          console.error(
            'Failed to load faculty:',
            error
          );


          this.teachers = [];

          this.filteredTeachers = [];

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
          a.name.localeCompare(
            b.name
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


        /*
         * Current department first.
         */

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


        /*
         * Within same priority,
         * sort alphabetically.
         */

        return String(a.name || '')
          .localeCompare(
            String(b.name || '')
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
        teacher => {

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
  // LOAD ROOMS
  // ==================================================

loadRooms(): void {

  this.loadingRooms = true;

  this.roomService
    .getRooms()
    .subscribe({

      next: (data: any[]) => {

        console.log('RAW ROOMS:', data);
        console.log('ROOM COUNT:', data?.length);

        this.loadingRooms = false;

        this.rooms = data || [];
        this.cdr.detectChanges();

        this.filterRooms();
        this.filterRoomsBySearch();

      },

      error: (error) => {

        this.loadingRooms = false;

        console.error(
          'Failed to load rooms:',
          error
        );

        this.rooms = [];
        this.availableRooms = [];

      }

    });

}


  // ==================================================
  // BATCH CHANGE
  // ==================================================

onBatchChange(): void {

  this.calculateStudents();

  /*
   * Re-filter and re-sort rooms because
   * the required capacity has changed.
   */

  this.filterRooms();


  /*
   * If the currently selected room can no
   * longer accommodate the students,
   * remove the selection.
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


  // ==================================================
  // CALCULATE STUDENTS
  // ==================================================

  calculateStudents(): void {

    this.totalStudents =
      this.batches

        .filter(
          batch => batch.selected
        )

        .reduce(
          (
            total,
            batch
          ) =>

            total +
            Number(
              batch.students || 0
            ),

          0
        );

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
    return;
  }

  /*
   * Selected lecture type:
   *
   * L = Lecture
   * T = Tutorial
   * P = Practical
   */
  const selectedType =
    String(this.lectureType || '')
      .trim()
      .toUpperCase();


  /*
   * Create a copy so that the original
   * rooms array is not modified.
   */
  this.availableRooms = [...this.rooms];


  /*
   * Sort rooms according to priority.
   */
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


    /*
     * ----------------------------------------
     * TYPE MATCH
     * ----------------------------------------
     */

    const aTypeMatch =
      aType === selectedType;

    const bTypeMatch =
      bType === selectedType;


    /*
     * ----------------------------------------
     * CAPACITY MATCH
     * ----------------------------------------
     */

    const aCapacityEnough =
      aCapacity >= this.totalStudents;

    const bCapacityEnough =
      bCapacity >= this.totalStudents;


    /*
     * ----------------------------------------
     * PRIORITY
     * ----------------------------------------
     *
     * 1 = Correct type + enough capacity
     * 2 = Correct type + insufficient capacity
     * 3 = Wrong type + enough capacity
     * 4 = Wrong type + insufficient capacity
     */

    const getPriority = (
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


    /*
     * First sort by priority.
     */
    if (
      aPriority !== bPriority
    ) {

      return (
        aPriority -
        bPriority
      );

    }


    /*
     * Within the same priority:
     *
     * Smaller suitable room first.
     *
     * Example:
     * 90 seats before 120 seats
     */
    if (
      aCapacityEnough &&
      bCapacityEnough
    ) {

      return (
        aCapacity -
        bCapacity
      );

    }


    /*
     * For insufficient rooms,
     * larger capacity first.
     *
     * Example:
     * 60 seats before 30 seats
     * when 90 are required.
     */
    return (
      bCapacity -
      aCapacity
    );

  });
  
  // Update searchable room list
  this.filterRoomsBySearch();

}

// ==================================================
// SELECT ROOM
// ==================================================

selectRoom(room: any): void {

  /*
   * Prevent selecting a room that
   * cannot accommodate all students.
   */

  if (
    this.totalStudents > 0 &&
    Number(room.capacity || 0) < this.totalStudents
  ) {

    return;

  }


  // Select exactly ONE room
  this.selectedRoom = room;


  // Close dropdown
  this.roomDropdownOpen = false;


  // Clear search
  this.roomSearch = '';

}

// ==================================================
// FILTERED ROOMS FOR SEARCH
// ==================================================

filteredRooms: any[] = [];

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

  toggleTeacher(
    teacher: any
  ): void {

    const exists =
      this.selectedTeachers.some(
        t =>
          t.id === teacher.id
      );


    if (exists) {

      this.selectedTeachers =
        this.selectedTeachers.filter(
          t =>
            t.id !== teacher.id
        );

    }
    else {

      this.selectedTeachers.push(
        teacher
      );

    }

  }


  // ==================================================
  // CHECK TEACHER
  // ==================================================

  isTeacherSelected(
    teacher: any
  ): boolean {

    return this.selectedTeachers.some(
      t =>
        t.id === teacher.id
    );

  }


  // ==================================================
  // SUBMIT
  // ==================================================

  submit(): void {

    const selectedBatches =
      this.batches.filter(
        batch =>
          batch.selected
      );


    if (
      selectedBatches.length === 0
    ) {

      alert(
        'Please select at least one batch.'
      );

      return;

    }


    if (
      !this.selectedSubject
    ) {

      alert(
        'Please select a subject.'
      );

      return;

    }


    if (
      !this.selectedRoom
    ) {

      alert(
        'Please select a room.'
      );

      return;

    }


    // const data = {

    //   lectureType:
    //     this.lectureType,

    //   batches:
    //     selectedBatches,

    //   subjectCode:
    //     this.selectedSubject.code,

    //   subjectName:
    //     this.selectedSubject.name,

    //   room:
    //     this.selectedRoom.name,

    //   roomId:
    //     this.selectedRoom.id,

    //   teachers:
    //     this.selectedTeachers,

    //   totalStudents:
    //     this.totalStudents

    // };

    const data = {

  lectureType:
    this.lectureType,

  batches:
    selectedBatches,

  subjectCode:
    this.selectedSubject.code,

  subjectName:
    this.selectedSubject.name,

  room:
    this.selectedRoom.room_id,

  roomId:
    this.selectedRoom.id,

  roomName:
    this.selectedRoom.room_name,

  roomType:
    this.selectedRoom.room_type,

  roomCapacity:
    this.selectedRoom.capacity,

  teachers:
    this.selectedTeachers,

  totalStudents:
    this.totalStudents

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