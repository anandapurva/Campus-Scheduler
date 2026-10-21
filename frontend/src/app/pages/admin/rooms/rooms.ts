import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../../services/room';
import { finalize } from 'rxjs';
import { CsvTemplateService } from '../../../services/csv-template';
@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './rooms.html',
  styleUrl: './rooms.css'
})
export class Rooms implements OnInit {

  // ==========================================
  // FILE
  // ==========================================

  selectedFile: File | null = null;

  isPreviewing = false;

  isImporting = false;

  importCompleted = false;


  // ==========================================
  // PREVIEW
  // ==========================================

  previewData: any[] = [];

  errors: any[] = [];

  totalRows = 0;

  validRows = 0;

  errorCount = 0;


  previewCurrentPage = 1;

  previewPageSize = 10;


  // ==========================================
  // ROOMS
  // ==========================================

  rooms: any[] = [];

  filteredRooms: any[] = [];


  // ==========================================
  // FILTERS
  // ==========================================

  selectedDepartment = 'ALL';

  selectedRoomType = 'ALL';

  selectedStatus = 'ALL';


  // ==========================================
  // ADD / EDIT ROOM FORM
  // ==========================================

  isRoomModalOpen = false;
  isEditingRoom = false;
  isSavingRoom = false;
  editingRoomDbId: number | null = null;

  roomForm = {
    room_id: '',
    room_name: '',
    room_type: 'L',
    capacity: 60 as number | null,
    department: 'ALL'
  };

  // ==========================================
  // IMPORT RESULT
  // ==========================================

  importResult: any = null;


  // ==========================================
  // TOAST
  // ==========================================

  toastMessage = '';

  toastType: 'success' | 'error' = 'success';

  showToast = false;


  // ==========================================
  // PAGINATION
  // ==========================================

  roomCurrentPage = 1;

  roomPageSize = 10;


  constructor(
    private roomService: RoomService,
    private csvTemplateService: CsvTemplateService,
    private cdr: ChangeDetectorRef
  ) {}


  // ==========================================
  // INIT
  // ==========================================

  ngOnInit(): void {

    this.loadRooms();

  }


  // ==========================================
  // FILE SELECT
  // ==========================================

  onFileSelected(event: Event): void {

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


  // ==========================================
  // FILE NAME
  // ==========================================

  get fileName(): string {

    return this.selectedFile
      ? this.selectedFile.name
      : 'No file selected';

  }


  // ==========================================
  // PREVIEW CSV
  // ==========================================

  preview(): void {

    if (!this.selectedFile) {

      this.showToastMessage(
        'Please select a CSV file first.',
        'error'
      );

      return;

    }


    this.isPreviewing = true;


    this.roomService
      .previewCSV(this.selectedFile)
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


          this.previewCurrentPage = 1;

          this.isPreviewing = false;


          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'ROOM PREVIEW ERROR:',
            error
          );


          this.isPreviewing = false;


          this.showToastMessage(

            error.error?.message ||
            'Failed to preview room CSV.',

            'error'

          );

        }

      });

  }

downloadRoomTemplate(): void {
  this.csvTemplateService.downloadTemplate(
    'room_template.csv',
    ['room_id', 'room_name', 'room_type', 'department', 'capacity']
  );
}

  importData(): void {

  // ==========================================
  // VALIDATION
  // ==========================================

  if (this.errorCount > 0) {

    this.showToastMessage(
      'Please fix all CSV errors before importing.',
      'error'
    );

    return;
  }


  if (this.previewData.length === 0) {

    this.showToastMessage(
      'No room data available to import.',
      'error'
    );

    return;
  }


  // ==========================================
  // PREVENT DOUBLE CLICK
  // ==========================================

  if (this.isImporting) {
    return;
  }


  console.log('====================================');
  console.log('ROOM IMPORT STARTED');
  console.log('Rows:', this.previewData.length);
  console.log('Data:', this.previewData);
  console.log('====================================');


  this.isImporting = true;

  this.cdr.detectChanges();


  // ==========================================
  // API CALL
  // ==========================================

  this.roomService
    .importRooms(this.previewData)
    .subscribe({

      // ========================================
      // SUCCESS
      // ========================================

      next: (response) => {

        console.log(
          'ROOM IMPORT RESPONSE:',
          response
        );


        this.isImporting = false;

        this.importCompleted = true;


        // ======================================
        // SAVE RESULT
        // ======================================

        this.importResult = {

          total:
            response.total || 0,

          inserted:
            response.inserted || 0,

          updated:
            response.updated || 0,

          unchanged:
            response.unchanged || 0

        };


        // ======================================
        // SHOW RESULT
        // ======================================

        this.showToastMessage(
          'Room import completed successfully.',
          'success'
        );


        // ======================================
        // RELOAD ROOMS
        // ======================================

        this.loadRooms();


        // ======================================
        // RESET PREVIEW
        // ======================================

        this.resetPreview();


        this.cdr.detectChanges();

      },


      // ========================================
      // ERROR
      // ========================================

      error: (error) => {

        console.error(
          '===================================='
        );

        console.error(
          'ROOM IMPORT ERROR'
        );

        console.error(
          'STATUS:',
          error.status
        );

        console.error(
          'ERROR:',
          error
        );

        console.error(
          'ERROR BODY:',
          error.error
        );

        console.error(
          '===================================='
        );


        // VERY IMPORTANT

        this.isImporting = false;


        this.cdr.detectChanges();


        this.showToastMessage(

          error.error?.message ||
          'Room import failed.',

          'error'

        );

      },

      // ========================================
      // COMPLETE
      // ========================================

      complete: () => {

        console.log(
          'ROOM IMPORT REQUEST COMPLETED'
        );

        this.isImporting = false;

        this.cdr.detectChanges();

      }

    });

}


  // ==========================================
  // LOAD ROOMS
  // ==========================================

  loadRooms(): void {

    this.roomService
      .getRooms()
      .subscribe({

        next: (data) => {

          this.rooms = data || [];

          this.applyFilters();

          this.cdr.detectChanges();

        },


        error: (error) => {

          console.error(
            'LOAD ROOMS ERROR:',
            error
          );

          this.showToastMessage(
            'Failed to load rooms.',
            'error'
          );

        }

      });

  }


  // ==========================================
  // DEPARTMENTS
  // ==========================================

  get departments(): string[] {

    const departments =
      this.rooms

        .map(room => room.department)

        .filter(
          department =>
            department &&
            department !== 'ALL'
        );


    return [
      ...new Set(departments)
    ];

  }


  // ==========================================
  // FILTER ROOMS
  // ==========================================

  applyFilters(): void {

    this.filteredRooms =
      this.rooms.filter(room => {


        // -------------------------------
        // DEPARTMENT
        // -------------------------------

        const departmentMatch =

          this.selectedDepartment === 'ALL' ||

          room.department ===
            this.selectedDepartment ||

          room.department === 'ALL';


        // -------------------------------
        // ROOM TYPE
        // -------------------------------

        const typeMatch =

          this.selectedRoomType === 'ALL' ||

          room.room_type ===
            this.selectedRoomType;


        // -------------------------------
        // STATUS
        // -------------------------------

        const statusMatch =

          this.selectedStatus === 'ALL' ||

          this.getRoomStatus(room) ===
            this.selectedStatus;


        return (

          departmentMatch &&

          typeMatch &&

          statusMatch

        );

      });


    this.roomCurrentPage = 1;

  }


  // ==========================================
  // ROOM STATUS
  // ==========================================

  getRoomStatus(room: any): string {

    /*
      This assumes the backend returns:

      occupied: true / false

      Later we can calculate this
      automatically from timetable data.
    */

    return room.occupied
      ? 'OCCUPIED'
      : 'VACANT';

  }


  // ==========================================
  // ROOM TYPE LABEL
  // ==========================================

  getRoomTypeLabel(type: string): string {

    switch (type) {

      case 'L':
        return 'Lecture';

      case 'T':
        return 'Tutorial';

      case 'P':
        return 'Practical';

      default:
        return type;

    }

  }


  // ==========================================
  // PREVIEW PAGINATION
  // ==========================================

  get paginatedPreviewData(): any[] {

    const start =
      (this.previewCurrentPage - 1) *
      this.previewPageSize;


    const end =
      start + this.previewPageSize;


    return this.previewData.slice(
      start,
      end
    );

  }


  get previewTotalPages(): number {

    return Math.ceil(

      this.previewData.length /
      this.previewPageSize

    );

  }


  previousPreviewPage(): void {

    if (
      this.previewCurrentPage > 1
    ) {

      this.previewCurrentPage--;

    }

  }


  nextPreviewPage(): void {

    if (

      this.previewCurrentPage <
      this.previewTotalPages

    ) {

      this.previewCurrentPage++;

    }

  }


  // ==========================================
  // ROOM PAGINATION
  // ==========================================

  get paginatedRooms(): any[] {

    const start =
      (this.roomCurrentPage - 1) *
      this.roomPageSize;


    const end =
      start + this.roomPageSize;


    return this.filteredRooms.slice(
      start,
      end
    );

  }


  get roomTotalPages(): number {

    return Math.ceil(

      this.filteredRooms.length /
      this.roomPageSize

    );

  }


  previousRoomPage(): void {

    if (
      this.roomCurrentPage > 1
    ) {

      this.roomCurrentPage--;

    }

  }


  nextRoomPage(): void {

    if (

      this.roomCurrentPage <
      this.roomTotalPages

    ) {

      this.roomCurrentPage++;

    }

  }


  // ==========================================
  // RESET
  // ==========================================

  resetPreview(): void {

    this.previewData = [];

    this.errors = [];

    this.totalRows = 0;

    this.validRows = 0;

    this.errorCount = 0;

    this.importCompleted = false;

    this.previewCurrentPage = 1;

  }

  // ==========================================
// OPEN ADD ROOM FORM
// ==========================================

openAddRoom(): void {
  this.isEditingRoom = false;
  this.editingRoomDbId = null;

  this.roomForm = {
    room_id: '',
    room_name: '',
    room_type: 'L',
    capacity: 60,
    department: 'ALL'
  };

  this.isRoomModalOpen = true;
}


// ==========================================
// OPEN EDIT ROOM FORM
// ==========================================

editRoom(room: any): void {
  this.isEditingRoom = true;
  this.editingRoomDbId = Number(room.id);

  this.roomForm = {
    room_id: room.room_id ?? '',
    room_name: room.room_name ?? '',
    room_type: room.room_type ?? 'L',
    capacity: Number(room.capacity),
    department: room.department ?? 'ALL'
  };

  this.isRoomModalOpen = true;
  this.cdr.detectChanges();
}


// ==========================================
// CLOSE ROOM FORM
// ==========================================

closeRoomModal(): void {
  if (this.isSavingRoom) {
    return;
  }

  this.isRoomModalOpen = false;
}


// ==========================================
// SAVE ROOM — ADD OR UPDATE
// ==========================================

saveRoom(): void {
  const roomId = this.roomForm.room_id.trim();
  const roomName = this.roomForm.room_name.trim();
  const roomType = this.roomForm.room_type;
  const department = this.roomForm.department.trim().toUpperCase();
  const capacity = Number(this.roomForm.capacity);

  if (!roomId || !roomName || !department) {
    this.showToastMessage(
      'Please fill in all room fields.',
      'error'
    );
    return;
  }

  if (!['L', 'T', 'P'].includes(roomType)) {
    this.showToastMessage(
      'Please select a valid room type.',
      'error'
    );
    return;
  }

  if (
    this.roomForm.capacity === null ||
    this.roomForm.capacity === undefined ||
    this.roomForm.capacity === '' as any ||
    !Number.isInteger(capacity) ||
    capacity <= 0
  ) {
    this.showToastMessage(
      'Capacity must be a positive whole number.',
      'error'
    );
    return;
  }

  if (this.isSavingRoom) {
    return;
  }

  const payload = {
    room_id: roomId,
    room_name: roomName,
    room_type: roomType,
    department,
    capacity
  };

  this.isSavingRoom = true;

  const request$ = this.isEditingRoom
    ? this.roomService.updateRoom(
        this.editingRoomDbId!,
        payload
      )
    : this.roomService.addRoom(payload);

  request$
    .pipe(
      finalize(() => {
        this.isSavingRoom = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (response) => {
        this.isRoomModalOpen = false;

        this.showToastMessage(
          response.message ||
            (this.isEditingRoom
              ? 'Room updated successfully.'
              : 'Room added successfully.'),
          'success'
        );

        this.loadRooms();
      },
      error: (error) => {
        console.error('SAVE ROOM ERROR:', error);

        this.showToastMessage(
          error.error?.message || 'Failed to save room.',
          'error'
        );
      }
    });
}


// ==========================================
// DELETE ROOM
// ==========================================

deleteRoom(room: any): void {
  const confirmed = window.confirm(
    `Are you sure you want to delete room "${room.room_id}" (${room.room_name})?`
  );

  if (!confirmed) {
    return;
  }

  this.roomService.deleteRoom(Number(room.id))
    .subscribe({
      next: (response) => {
        this.showToastMessage(
          response.message || 'Room deleted successfully.',
          'success'
        );

        this.loadRooms();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('DELETE ROOM ERROR:', error);

        this.showToastMessage(
          error.error?.message || 'Failed to delete room.',
          'error'
        );
      }
    });
}

  // ==========================================
  // TOAST
  // ==========================================

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

    }, 4000);

  }

}