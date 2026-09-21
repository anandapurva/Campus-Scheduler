import { Component, EventEmitter, Input, Output, ChangeDetectorRef, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { FacultyService } from '../../../services/faculty';
import { RoomService } from '../../../services/room';
import { AcademicSessionService } from '../../../services/academic-session';
import { BatchService, Batch } from '../../../services/batch';
import { SubjectService } from '../../../services/subject';
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

  @Input() academicSessionId: number | null = null;

@Input() academicSessionStartYear: number | null = null;


  @Input()
  department = '';

  // ==================================================
  // OUTPUTS
  // ==================================================

  @Output()
  save = new EventEmitter<any>();

  @Output()
  cancel = new EventEmitter<void>();

  academicSessions: any[] = [];

  selectedAcademicSessionId: number | null = null;

  selectedAcademicSessionStartYear: number | null = null;

  academicSessionLoading = false;

  academicSessionError = '';

  eligibleBatches: any[] = [];

  batchSearch = '';
  filteredBatches: any[] = [];

  // ==================================================
  // LOCK LUNCH
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
  // FACULTY SEARCH
  // ==================================================

  teacherSearch = '';

  filteredTeachers: any[] = [];

  // ==================================================
  // SELECTED DATA
  // ==================================================

  isSubjectDropdownOpen = false;

  subjectSearch = '';

  filteredSubjects: any[] = [];

  selectedSubject: any = null;

  selectedTeachers: any[] = [];

  selectedRoom: any = null;

  // ==================================================
  // ROOM DROPDOWN
  // ==================================================

  roomDropdownOpen = false;
  isBatchDropdownOpen = false;
  isTeacherDropdownOpen = false;

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
    private subjectService: SubjectService,
    private academicSessionService: AcademicSessionService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================================================
  // INPUT CHANGES
  // ==================================================

ngOnInit(): void {

  // Use values received from the parent component
  this.selectedAcademicSessionId = this.academicSessionId;
  this.selectedAcademicSessionStartYear =
    this.academicSessionStartYear;

  this.loadFaculty();
  this.loadRooms();
  this.loadSubjects();
  this.loadEligibleBatches();
}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['academicSessionId']) {
      this.selectedAcademicSessionId =
        this.academicSessionId;
    }

    if (changes['academicSessionStartYear']) {
      this.selectedAcademicSessionStartYear =
        this.academicSessionStartYear;
    }

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

    if (changes['department']) {
      this.sortFaculty();
      this.filteredTeachers = [...this.teachers];
    }
  }

  loadActiveAcademicSession(): void {
  this.academicSessionLoading = true;
  this.academicSessionError = '';

  this.academicSessionService
    .getActiveSession()
    .subscribe({
      next: (response) => {
        this.academicSessionLoading = false;

        if (response.active && response.session) {
          this.academicSessions = [response.session];

          this.selectedAcademicSessionId =
            response.session.id;

          this.selectedAcademicSessionStartYear =
            Number(response.session.start_year);

          this.loadEligibleBatches();
        } else {
          this.academicSessions = [];
          this.selectedAcademicSessionId = null;
          this.selectedAcademicSessionStartYear = null;

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

    this.batchService.getEligibleBatches(
      this.program,
      Number(this.semester),
      this.department,
      Number(this.selectedAcademicSessionStartYear)
    ).subscribe({

      next: (response: any) => {

        this.eligibleBatches =
          Array.isArray(response?.batches)
            ? response.batches
            : [];

        // IMPORTANT:
        // The HTML displays filteredBatches.
        // Initially show all eligible batches.
        this.filteredBatches =
          [...this.eligibleBatches];

        this.loadingBatches = false;
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
  // BATCHES SEARCH
  // ==================================================

  searchBatches(): void {
  const searchText = this.batchSearch
    .trim()
    .toLowerCase();

  if (!searchText) {
    this.filteredBatches = [...this.eligibleBatches];
    return;
  }

  this.filteredBatches = this.eligibleBatches.filter(
    (batch: any) => {
      const batchCode =
        String(batch.batch_code || '').toLowerCase();

      const program =
        String(batch.program || '').toLowerCase();

      const batchType =
        String(batch.batch_type || '').toLowerCase();

      const enrollmentYear =
        String(batch.enrollment_year || '').toLowerCase();

      const department =
        String(batch.department || '').toLowerCase();

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

  checkBatchLunch(batch: any): void {
    if (!this.selectedAcademicSessionStartYear || !batch?.id) {
      batch.lunchLocked = false;
      return;
    }

    this.batchService.getLunchForBatch(
      Number(batch.id),
      Number(this.selectedAcademicSessionStartYear)
    ).subscribe({
      next: (response: any) => {

        batch.lunchLocked = response?.locked === true;

        const configurations = Array.isArray(response?.configuration)
          ? response.configuration
          : [];

        /*
        * For a batch, both semester configurations have
        * the same lunch period, so the first one is enough.
        */
        const config = configurations[0];

        batch.lunchStart =
          config?.lunchStart ||
          config?.lunch_start ||
          '';

        batch.lunchEnd =
          config?.lunchEnd ||
          config?.lunch_end ||
          '';

        batch.lunchSource = response?.lunchSource || null;

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
  // BATCH SELECTION
  // ==================================================

  isBatchSelected(batch: Batch): boolean {
    return this.selectedBatches.some(
      selectedBatch => selectedBatch.id === batch.id
    );
  }

  isBatchLunchLocked(batch: any): boolean {

  if (!batch?.lunchLocked) {
    return false;
  }

  // Your selected cell stores time inside selectedCell.slot
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
    console.log('NO SLOT TIME FOUND:', {
      batchId: batch.id,
      selectedCell: this.selectedCell
    });

    return false;
  }

  const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const lunchStart = toMinutes(batch.lunchStart);
  const lunchEnd = toMinutes(batch.lunchEnd);

  const slotStartMinutes = toMinutes(slotStart);
  const slotEndMinutes = toMinutes(slotEnd);

  const locked =
    slotStartMinutes < lunchEnd &&
    slotEndMinutes > lunchStart;

  return locked;
  }

  onBatchChange(batch: Batch, event: Event): void {
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

  toggleBatch(batch: any): void {

  // Do not allow a batch whose lunch overlaps
  // the currently selected timetable slot.
  if (
    !this.isBatchSelected(batch) &&
    this.isBatchLunchLocked(batch)
  ) {
    console.warn(
      'Cannot select batch because of lunch:',
      batch.batch_code,
      batch.lunchStart,
      batch.lunchEnd
    );

    return;
  }

  const alreadySelected =
    this.isBatchSelected(batch);

  if (alreadySelected) {

    this.selectedBatches =
      this.selectedBatches.filter(
        (selectedBatch: any) =>
          selectedBatch.id !== batch.id
      );

  } else {

    this.selectedBatches = [
      ...this.selectedBatches,
      batch
    ];

  }

  this.calculateStudents();

  this.filterRooms();

  if (
    this.selectedRoom &&
    this.totalStudents > 0 &&
    Number(this.selectedRoom.capacity || 0) <
      this.totalStudents
  ) {
    this.selectedRoom = null;
  }

  this.cdr.detectChanges();
  }

  toggleBatchDropdown(): void {
    this.isBatchDropdownOpen = !this.isBatchDropdownOpen;
  }

  calculateStudents(): void {
    // Every batch contains exactly 30 students.
    this.totalStudents = this.selectedBatches.length * 30;
  }

  // ==================================================
  // LOAD FACULTY
  // ==================================================

  loadFaculty(): void {
    this.loadingFaculty = true;

    this.facultyService.getFaculty().subscribe({
      next: (response: any) => {

        if (Array.isArray(response)) {
          this.teachers = response;
        } else if (Array.isArray(response?.faculty)) {
          this.teachers = response.faculty;
        } else if (Array.isArray(response?.data)) {
          this.teachers = response.data;
        } else {
          this.teachers = [];
        }

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
  // TEACHER SELECTION
  // ==================================================

  toggleFaculty(teacher: any): void {
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

  toggleFacultyDropdown(): void {
    this.isTeacherDropdownOpen = !this.isTeacherDropdownOpen;
  }

  // ==================================================
  // CHECK TEACHER
  // ==================================================

  isFacultySelected(teacher: any): boolean {
    return this.selectedTeachers.some(
      t => t.id === teacher.id
    );
  }

  // ==================================================
  // LOAD ROOMS
  // ==================================================

  loadRooms(): void {
    this.loadingRooms = true;

    this.roomService.getRooms().subscribe({
      next: (response: any) => {

        if (Array.isArray(response)) {
          this.rooms = response;
        } else if (Array.isArray(response?.rooms)) {
          this.rooms = response.rooms;
        } else if (Array.isArray(response?.data)) {
          this.rooms = response.data;
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
// LOAD SUBJECTS
// ==================================================

  loadSubjects(): void {

    if (
      !this.program ||
      !this.semester ||
      !this.department
    ) {

      this.subjects = [];
      return;
    }

    this.subjectService
      .getSubjects(
        this.program,
        this.department,
        Number(this.semester)
      )
      .subscribe({

        next: (response: any) => {

          if (Array.isArray(response)) {

            this.subjects = response;

          } else if (Array.isArray(response?.subjects)) {

            this.subjects = response.subjects;

          } else if (Array.isArray(response?.data)) {

            this.subjects = response.data;

          } else {

            this.subjects = [];

          }
          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error(
            'Failed to load subjects:',
            error
          );

          this.subjects = [];

          this.cdr.detectChanges();

        }

      });
  }

  getProgramCode(): string {
    const value = String(this.program).trim().toUpperCase();

    if (value === 'BTECH' || value === 'MTECH') {
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

  if (this.isSubjectDropdownOpen) {

    this.subjectSearch = '';

    this.filteredSubjects =
      [...this.subjects];

  }

}


// ==================================================
// SEARCH SUBJECTS
// ==================================================

searchSubjects(): void {

  const search =
    this.subjectSearch
      .trim()
      .toLowerCase();

  if (!search) {

    this.filteredSubjects =
      [...this.subjects];

    return;
  }

  this.filteredSubjects =
    this.subjects.filter(subject => {

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

    });

}


// ==================================================
// SELECT SUBJECT
// ==================================================

  selectSubject(subject: any): void {

    this.selectedSubject = subject;

    this.isSubjectDropdownOpen = false;

    this.subjectSearch = '';

    this.filteredSubjects =
      [...this.subjects];

    this.cdr.detectChanges();
  }

  // ==================================================
  // SUBMIT
  // ==================================================

  submit(): void {

    if (!this.selectedAcademicSessionId) {
      alert(
        'Timetable creation is disabled because no academic session is active.'
      );
      return;
    }

    if (this.selectedBatches.length === 0) {
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

      // Academic session
      academicSessionId:
        Number(this.selectedAcademicSessionId),

      // Program / Department / Semester
      programId:
        Number(this.selectedSubject.program_id),

      departmentId:
        Number(this.selectedSubject.department_id),

      semesterId:
        Number(this.selectedSubject.semester_id),

      // Timetable position
      day:
        this.selectedCell?.day,

      slotId:
        Number(this.selectedCell?.slot?.id),

      startTime:
        this.selectedCell?.slot?.start,

      endTime:
        this.selectedCell?.slot?.end,

      // Subject
      subjectId:
        Number(this.selectedSubject.id),

      subjectCode:
        this.selectedSubject.course_code,

      subjectName:
        this.selectedSubject.subject_name,

      // Lecture type
      lectureType:
        this.lectureType,

      // Room
      roomId:
        Number(this.selectedRoom.id),

      room:
        this.selectedRoom.room_id,

      roomName:
        this.selectedRoom.room_name,

      roomType:
        this.selectedRoom.room_type,

      roomCapacity:
        Number(this.selectedRoom.capacity),

      // Batches
      batches:
        this.selectedBatches,

      batchIds:
        this.selectedBatches.map(
          batch => Number(batch.id)
        ),

      // Faculty
      teachers:
        this.selectedTeachers,

      teacherIds:
        this.selectedTeachers.map(
          teacher => Number(teacher.id)
        ),

      // Students
      totalStudents:
        Number(this.totalStudents)
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