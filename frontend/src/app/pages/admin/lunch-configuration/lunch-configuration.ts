import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { from, concatMap, toArray, finalize } from 'rxjs';
import { TimetableConfigService } from '../../../services/timetable-config';


@Component({
  selector: 'app-lunch-configuration',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './lunch-configuration.html',

  styleUrls: [ './lunch-configuration.css']
})

export class LunchConfiguration {


  // =========================================================
  // SELECTED YEARS
  // =========================================================

  selectedYears: {
    BTECH: number[];
    MTECH: number[];
  } = {

    BTECH: [],

    MTECH: []

  };


  // =========================================================
  // ALREADY LOCKED YEARS
  // =========================================================

  lockedYears: {
    BTECH: number[];
    MTECH: number[];
  } = {

    BTECH: [],

    MTECH: []

  };


  // =========================================================
  // UI STATE
  // =========================================================

  lunchLocked = false;

  loading = false;

  message = '';

  errorMessage = '';


  // =========================================================
  // CHANGE LUNCH / EDITING STATE
  // =========================================================

  isEditing = false;

  editingProgram:
    'BTECH' | 'MTECH' | null = null;

  editingYear:
    number | null = null;

  editingLunchStart = '';
  editingLunchEnd = '';

  currentLockedLunchStart = '';
  currentLockedLunchEnd = '';


  // =========================================================
  // TOAST
  // =========================================================

  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // =========================================================
  // SELECTED LUNCH SLOT
  // =========================================================

  selectedLunchStart = '';

  selectedLunchEnd = '';


  // =========================================================
  // AVAILABLE LUNCH SLOTS
  // =========================================================

  lunchSlots = [

    {
      label: '12:00 PM - 1:00 PM',

      start: '12:00:00',

      end: '13:00:00'
    },

    {
      label: '1:00 PM - 2:00 PM',

      start: '13:00:00',

      end: '14:00:00'
    },

    {
      label: '2:00 PM - 3:00 PM',

      start: '14:00:00',

      end: '15:00:00'
    }

  ];


  constructor(

    private timetableConfigService:
      TimetableConfigService,

    private cdr:
      ChangeDetectorRef

  ) {}


  // =========================================================
  // YEAR LABEL
  // =========================================================

  getYearLabel(
    year: number
  ): string {

    if (year === 1) {

      return '1st Year';

    }

    if (year === 2) {

      return '2nd Year';

    }

    if (year === 3) {

      return '3rd Year';

    }

    return `${year}th Year`;

  }


  // =========================================================
  // CHECK WHETHER YEAR IS LOCKED
  // =========================================================

  isYearLocked(

    program: 'BTECH' | 'MTECH',
    year: number

  ): boolean {

    return this.lockedYears[program]
      .includes(year);

  }


  // =========================================================
  // SELECT / UNSELECT YEAR
  // =========================================================

  toggleYear(

    program: 'BTECH' | 'MTECH',
    year: number,
    event: Event

  ): void {

    const checkbox = event.target as HTMLInputElement;


    // =======================================================
    // NEVER ALLOW NORMAL SELECTION OF LOCKED YEAR
    // =======================================================

    if (
      this.isYearLocked(
        program,
        year
      )
    ) {

      checkbox.checked = false;

      return;

    }


    // =======================================================
    // ADD
    // =======================================================

    if (checkbox.checked) {

      if (
        !this.selectedYears[program]
          .includes(year)
      ) {

        this.selectedYears[program]
          .push(year);

      }

    }


    // =======================================================
    // REMOVE
    // =======================================================

    else {

      this.selectedYears[program] =
        this.selectedYears[program]
          .filter(
            y => y !== year
          );

    }


    this.message = '';

    this.errorMessage = '';

    this.lunchLocked = false;

  }


  // =========================================================
  // SELECT LUNCH
  // =========================================================

  selectLunch(

    start:
      string,

    end:
      string

  ): void {

    this.selectedLunchStart =
      start;

    this.selectedLunchEnd =
      end;


    this.message = '';

    this.errorMessage = '';

    this.lunchLocked = false;

  }


// =========================================================
// CHANGE LUNCH
// =========================================================

  changeLunch(
    program: 'BTECH' | 'MTECH',
    year: number
  ): void {

    // ============================================
    // ENTER EDIT MODE
    // ============================================

    this.isEditing = true;

    this.editingProgram = program;
    this.editingYear = year;

    // Clear new selection
    this.editingLunchStart = '';
    this.editingLunchEnd = '';

    // Clear old values before API response
    this.currentLockedLunchStart = '';
    this.currentLockedLunchEnd = '';

    this.message = '';
    this.errorMessage = '';

    this.cdr.detectChanges();


    // ============================================
    // LOAD CURRENT LOCKED LUNCH
    // ============================================

    this.timetableConfigService
      .getLunchConfiguration(
        program,
        year
      )
      .subscribe({

        next: (response: any) => {

          console.log(
            'CURRENT LUNCH CONFIG:',
            response
          );


          const configurations =
            response?.configuration || [];


          if (
            configurations.length > 0
          ) {

            this.currentLockedLunchStart =
              configurations[0]?.lunchStart || '';

            this.currentLockedLunchEnd =
              configurations[0]?.lunchEnd || '';


            console.log(
              'CURRENT LOCKED SLOT:',
              this.currentLockedLunchStart,
              this.currentLockedLunchEnd
            );

          }

          this.cdr.detectChanges();

        },


        error: (error: any) => {

          console.error(
            'FAILED TO LOAD CURRENT LUNCH:',
            error
          );

          this.errorMessage =
            'Failed to load current lunch configuration.';

          this.cdr.detectChanges();

        }

      });

  }

  // =========================================================
  // SELECT NEW LUNCH DURING EDIT
  // =========================================================

  selectEditingLunch(
    start: string,
    end: string
  ): void {

    this.editingLunchStart = start;

    this.editingLunchEnd = end;

  }


  // =========================================================
  // SHOW TOAST
  // =========================================================

  showToastMessage(
    message: string,
    type: 'success' | 'error' = 'success'
  ): void {

    this.toastMessage = message;

    this.toastType = type;

    this.showToast = true;


    // Automatically hide toast
    setTimeout(() => {

      this.showToast = false;

      this.cdr.detectChanges();

    }, 3000);

  }

  // =========================================================
  // CANCEL CHANGE LUNCH
  // =========================================================

  cancelChangeLunch(): void {

    this.isEditing = false;

    this.editingProgram = null;

    this.editingYear = null;

    this.editingLunchStart = '';

    this.editingLunchEnd = '';

    this.message = '';

    this.errorMessage = '';

  }

  isCurrentLockedLunchSlot(
    start: string,
    end: string
  ): boolean {

    return (
      this.currentLockedLunchStart === start &&
      this.currentLockedLunchEnd === end
    );

  }

  // =========================================================
  // SAVE CHANGED LUNCH
  // =========================================================

  saveChangedLunch(): void {

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (
      !this.editingProgram ||
      !this.editingYear
    ) {

      this.showToastMessage(
        'Invalid program/year selected.',
        'error'
      );

      return;

    }


    if (
      !this.editingLunchStart ||
      !this.editingLunchEnd
    ) {

      this.showToastMessage(
        'Please select a new lunch slot.',
        'error'
      );

      return;

    }


    // -------------------------------------------------------
    // REQUEST
    // -------------------------------------------------------

    const request = {

      program: this.editingProgram,

      year: this.editingYear,

      lunchStart: this.editingLunchStart,

      lunchEnd: this.editingLunchEnd,

      facultyId: 'ADMIN'

    };

    this.loading = true;


    // -------------------------------------------------------
    // CALL BACKEND
    // -------------------------------------------------------

    this.timetableConfigService
      .changeLunch(request)
      .pipe(

        finalize(() => {

          this.loading = false;

          this.cdr.detectChanges();

        })

      )
      .subscribe({

        // ===================================================
        // SUCCESS
        // ===================================================

        next: (response: any) => {

          console.log(
            'LUNCH CHANGE SUCCESS:',
            response
          );


          // Exit edit mode
          this.isEditing = false;

          this.editingProgram = null;

          this.editingYear = null;

          this.editingLunchStart = '';

          this.editingLunchEnd = '';


          // Clear normal messages
          this.message = '';

          this.errorMessage = '';

          this.lunchLocked = false;


          // =================================================
          // SHOW TOAST
          // =================================================

          this.showToastMessage(
            'Lunch changed successfully',
            'success'
          );


          this.cdr.detectChanges();


          // =================================================
          // RELOAD PAGE
          // =================================================

          setTimeout(() => {

            window.location.reload();

          }, 1200);

        },


        // ===================================================
        // ERROR
        // ===================================================

        error: (error: any) => {
          this.showToastMessage(

            error?.error?.message ||
            'Failed to change lunch.',

            'error'

          );

          this.cdr.detectChanges();

        }

      });

  }

  // =========================================================
  // LOAD ALL LOCKED CONFIGURATIONS
  // =========================================================

  checkLockedYears(): void {

    this.timetableConfigService
      .getAllLunchConfigurations()

      .subscribe({

        next: (response: any) => {

          this.lockedYears = {

            BTECH: [],

            MTECH: []

          };


          const configurations =
            response?.configurations || [];


          // =================================================
          // BTECH
          // =================================================

          const btechSemesters =
            configurations

              .filter(
                (config: any) =>
                  String(config.program)
                    .toUpperCase() ===
                  'BTECH'
              )

              .map(
                (config: any) =>
                  Number(config.semester)
              );


          if (
            btechSemesters.includes(1) &&
            btechSemesters.includes(2)
          ) {

            this.lockedYears.BTECH
              .push(1);

          }


          if (
            btechSemesters.includes(3) &&
            btechSemesters.includes(4)
          ) {

            this.lockedYears.BTECH
              .push(2);

          }


          if (
            btechSemesters.includes(5) &&
            btechSemesters.includes(6)
          ) {

            this.lockedYears.BTECH
              .push(3);

          }


          if (
            btechSemesters.includes(7) &&
            btechSemesters.includes(8)
          ) {

            this.lockedYears.BTECH
              .push(4);

          }


          // =================================================
          // MTECH
          // =================================================

          const mtechSemesters =
            configurations

              .filter(
                (config: any) =>
                  String(config.program)
                    .toUpperCase() ===
                  'MTECH'
              )

              .map(
                (config: any) =>
                  Number(config.semester)
              );


          if (
            mtechSemesters.includes(1) &&
            mtechSemesters.includes(2)
          ) {

            this.lockedYears.MTECH
              .push(1);

          }


          if (
            mtechSemesters.includes(3) &&
            mtechSemesters.includes(4)
          ) {

            this.lockedYears.MTECH
              .push(2);

          }


          // =================================================
          // REMOVE LOCKED YEARS FROM NORMAL SELECTION
          // =================================================

          this.selectedYears.BTECH =
            this.selectedYears.BTECH
              .filter(
                year =>
                  !this.isYearLocked(
                    'BTECH',
                    year
                  )
              );


          this.selectedYears.MTECH =
            this.selectedYears.MTECH
              .filter(
                year =>
                  !this.isYearLocked(
                    'MTECH',
                    year
                  )
              );


          this.cdr.detectChanges();

        },


        error: (error: any) => {

          console.error(
            'Failed to load lunch locks:',
            error
          );

        }

      });

  }


  // =========================================================
  // LOCK LUNCH
  // =========================================================

  lockLunch(): void {

    if (this.isEditing) {

      this.saveChangedLunch();

      return;

    }


    this.message = '';

    this.errorMessage = '';

    this.lunchLocked = false;

    // VALIDATE LUNCH

    if (
      !this.selectedLunchStart ||
      !this.selectedLunchEnd
    ) {

      this.errorMessage =
        'Please select a lunch slot.';

      return;

    }

    // VALIDATE PROGRAM/YEAR

    if (

      this.selectedYears.BTECH.length === 0 &&

      this.selectedYears.MTECH.length === 0

    ) {

      this.errorMessage =
        'Please select at least one program year.';

      return;

    }

    // CREATE REQUEST LIST

    const requests: any[] = [];


    // =======================================================
    // BTECH
    // =======================================================

    this.selectedYears.BTECH.forEach(
      (year: number) => {

        requests.push({

          program: 'BTECH',

          year: year,

          lunchStart:
            this.selectedLunchStart,

          lunchEnd:
            this.selectedLunchEnd,

          facultyId:
            'ADMIN'

        });

      }
    );


    // =======================================================
    // MTECH
    // =======================================================

    this.selectedYears.MTECH.forEach(
      (year: number) => {

        requests.push({

          program: 'MTECH',

          year: year,

          lunchStart:
            this.selectedLunchStart,

          lunchEnd:
            this.selectedLunchEnd,

          facultyId:
            'ADMIN'

        });

      }
    );


    console.log(
      'LUNCH LOCK REQUESTS:',
      requests
    );


    // =======================================================
    // START LOADING
    // =======================================================

    this.loading = true;


    this.cdr.detectChanges();

    // SEND REQUESTS ONE BY ONE


    from(requests)

      .pipe(

        concatMap(
          (request: any) => {

            return this
              .timetableConfigService
              .lockLunch(request);

          }
        ),

        toArray(),

        finalize(() => {

          this.loading = false;

          this.cdr.detectChanges();

        })

      )

      .subscribe({

        // ===================================================
        // SUCCESS
        // ===================================================

        next: (responses: any[]) => {

          // GET SUCCESS MESSAGE

          const successMessage =
            responses
              .map(
                (response: any) =>
                  response?.message
              )
              .filter(Boolean)
              .join(' ')
              ||
              'Lunch locked successfully.';

          this.message = '';
          this.errorMessage = '';
          this.lunchLocked = false;

          // =====================================================
          // SHOW TOAST
          // =====================================================

          this.showToastMessage(
            successMessage,
            'success'
          );


          // =====================================================
          // RELOAD PAGE AFTER TOAST IS VISIBLE
          // =====================================================

          setTimeout(() => {

            window.location.reload();

          }, 2000);

        },


        // ===================================================
        // ERROR
        // ===================================================
        error: (error: any) => {

          // ALREADY LOCKED
          if (error?.status === 409) {

            this.lunchLocked = true;

            this.message =
              error?.error?.message ||
              'Lunch is already locked for the selected program/year combination.';

            this.errorMessage = '';

            this.checkLockedYears();

            this.cdr.detectChanges();

            return;
          }


          // =====================================================
          // DEADLOCK
          // =====================================================

          if (
            error?.status === 500 &&
            (
              error?.error?.error?.includes(
                'Deadlock found'
              ) ||
              error?.error?.message?.includes(
                'Deadlock'
              )
            )
          ) {

            this.lunchLocked = false;
            this.message = '';

            this.errorMessage =
              'The lunch lock operation was temporarily blocked by another database operation. Please try again.';

            this.cdr.detectChanges();

            return;
          }


          // =====================================================
          // OTHER ERROR
          // =====================================================

          this.lunchLocked = false;
          this.message = '';

          this.errorMessage =
            error?.error?.message ||
            'Failed to lock lunch.';

          this.cdr.detectChanges();

        }

      });

  }


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  ngOnInit(): void {

    this.checkLockedYears();

  }

}