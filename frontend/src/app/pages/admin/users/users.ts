import {
  Component,
  OnInit,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  ProgramService
} from '../../../services/program';

import {
  DepartmentService
} from '../../../services/department';

import {
  TeacherEditAccessService
} from '../../../services/teacher-edit-access.service';


// ============================================================
// INTERFACES
// ============================================================

interface Program {
  id: number;
  name: string;
  semesters?: number;
  active?: number;
}


interface Teacher {
  id: number;
  faculty_id: number;
  name: string;
  abbreviation: string;
  department: string;
  can_edit: boolean;
}


interface DepartmentGroup {
  id: number;
  name: string;
  abbreviation: string;
  teachers: Teacher[];
}


// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-users',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './users.html',
  styleUrls: ['./users.css']
})
export class Users implements OnInit {


  // ============================================================
  // PROGRAM
  // ============================================================

  programs: Program[] = [];

  selectedProgram: number | null = null;

  loadingPrograms = false;


  // ============================================================
  // DEPARTMENTS
  // ============================================================

  departments: DepartmentGroup[] = [];

  selectedDepartment: number | null = null;

  loadingDepartments = false;


  // ============================================================
  // TEACHERS
  // ============================================================

  allTeachers: Teacher[] = [];

  loadingTeachers = false;

  teacherSearch = '';


  // ============================================================
  // ACCESS SELECTION
  // ============================================================

  selectedTeachers: number[] = [];

  originalSelectedTeachers: number[] = [];


  // ============================================================
  // SAVE STATE
  // ============================================================

  savingAccess = false;

  successMessage = '';

  errorMessage = '';


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private programService: ProgramService,
    private departmentService: DepartmentService,
    private teacherEditAccessService:
      TeacherEditAccessService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}


  // ============================================================
  // INITIALIZATION
  // ============================================================

  ngOnInit(): void {

    /*
     * IMPORTANT:
     *
     * Program is NOT selected automatically.
     *
     * But departments and teachers are loaded immediately.
     *
     * Therefore after page refresh:
     *
     * Program dropdown  -> visible
     * Department dropdown -> visible
     * Teachers -> ready
     */

    this.loadPrograms();

    this.loadDepartments();

  }


  // ============================================================
  // LOAD PROGRAMS
  // ============================================================

  loadPrograms(): void {

    this.loadingPrograms = true;

    this.errorMessage = '';

    console.log(
      '========== LOADING PROGRAMS =========='
    );


    this.programService
      .getPrograms()
      .subscribe({

        next: (response: any) => {

          this.ngZone.run(() => {

            this.loadingPrograms = false;

            console.log(
              'PROGRAM API RESPONSE:',
              response
            );


            let data: any[] = [];


            // --------------------------------------------------
            // RESPONSE FORMAT 1
            // --------------------------------------------------

            if (Array.isArray(response)) {

              data = response;

            }


            // --------------------------------------------------
            // RESPONSE FORMAT 2
            // --------------------------------------------------

            else if (
              response &&
              Array.isArray(response.programs)
            ) {

              data = response.programs;

            }


            // --------------------------------------------------
            // RESPONSE FORMAT 3
            // --------------------------------------------------

            else if (
              response &&
              Array.isArray(response.data)
            ) {

              data = response.data;

            }


            // --------------------------------------------------
            // NORMALIZE PROGRAMS
            // --------------------------------------------------

            this.programs = data

              .map(
                (program: any) => ({

                  id: Number(
                    program.id ??
                    program.program_id ??
                    program.programId ??
                    0
                  ),

                  name: String(
                    program.name ??
                    program.program_name ??
                    program.program ??
                    program.programName ??
                    ''
                  ),

                  semesters: Number(
                    program.semesters ??
                    program.total_semesters ??
                    0
                  ),

                  active: Number(
                    program.active ??
                    program.is_active ??
                    1
                  )

                })
              )

              .filter(
                program =>
                  program.id > 0 &&
                  program.name.trim() !== ''
              );


            console.log(
              'FINAL PROGRAMS:',
              this.programs
            );


            if (
              this.programs.length === 0
            ) {

              this.errorMessage =
                'No programs found.';

            }


            /*
             * DO NOT AUTO SELECT PROGRAM
             */

            this.selectedProgram = null;


            this.cdr.detectChanges();

          });

        },


        error: (error: any) => {

          this.ngZone.run(() => {

            this.loadingPrograms = false;

            console.error(
              'PROGRAM API ERROR:',
              error
            );

            this.errorMessage =
              'Failed to load programs.';

            this.cdr.detectChanges();

          });

        }

      });

  }


  // ============================================================
  // PROGRAM CHANGE
  // ============================================================

  onProgramChange(): void {

    console.log(
      'PROGRAM SELECTED:',
      this.selectedProgram
    );


    this.successMessage = '';

    this.errorMessage = '';


    /*
     * IMPORTANT:
     *
     * We DO NOT reload departments here.
     *
     * Departments are already loaded when the page opens.
     *
     * Therefore selecting a program does not make the
     * department dropdown disappear or wait for another click.
     */


    this.cdr.detectChanges();

  }


  // ============================================================
  // LOAD DEPARTMENTS
  // ============================================================

  loadDepartments(): void {

    console.log(
      '========== LOADING DEPARTMENTS =========='
    );


    this.loadingDepartments = true;

    this.errorMessage = '';


    this.departmentService
      .getDepartments()
      .subscribe({

        next: (response: any) => {

          this.ngZone.run(() => {

            console.log(
              'DEPARTMENT API RESPONSE:',
              response
            );


            if (!Array.isArray(response)) {

              console.error(
                'Department API did not return an array:',
                response
              );

              this.departments = [];

              this.loadingDepartments = false;

              this.errorMessage =
                'Invalid department response.';

              this.cdr.detectChanges();

              return;

            }


            // --------------------------------------------------
            // CREATE DEPARTMENT LIST
            // --------------------------------------------------

            this.departments = response

              .map(
                (department: any) => ({

                  id: Number(
                    department.id ?? 0
                  ),

                  name: String(
                    department.name ?? ''
                  ),

                  abbreviation: String(
                    department.abbreviation ?? ''
                  ),

                  teachers: []

                })
              )


              // ------------------------------------------------
              // REMOVE IT
              // ------------------------------------------------

              .filter(
                department =>
                  department.id > 0 &&
                  department.abbreviation
                    .trim()
                    .toUpperCase() !== 'IT'
              );


            // --------------------------------------------------
            // BIOTECH DISPLAY NAME
            // --------------------------------------------------

            this.departments.forEach(
              department => {

                const abbreviation =
                  department.abbreviation
                    .trim()
                    .toUpperCase();


                if (
                  abbreviation === 'BT'
                ) {

                  department.name =
                    'BioTech';

                }

              }
            );


            console.log(
              'FINAL DEPARTMENTS:',
              this.departments
            );


            this.loadingDepartments = false;


            this.cdr.detectChanges();


            /*
             * Departments are now available.
             *
             * Load teachers independently.
             */

            if (
              this.allTeachers.length === 0
            ) {

              this.loadTeachers();

            }

            else {

              this.assignTeachersToDepartments();

            }

          });

        },


        error: (error: any) => {

          this.ngZone.run(() => {

            this.loadingDepartments = false;

            console.error(
              'DEPARTMENT API ERROR:',
              error
            );

            this.errorMessage =
              'Failed to load departments.';

            this.cdr.detectChanges();

          });

        }

      });

  }


  // ============================================================
  // LOAD TEACHERS
  // ============================================================

  loadTeachers(): void {

    console.log(
      '========== LOADING TEACHERS =========='
    );


    this.loadingTeachers = true;


    this.teacherEditAccessService
      .getTeachers()
      .subscribe({

        next: (response: any) => {

          this.ngZone.run(() => {

            console.log(
              'TEACHER API RESPONSE:',
              response
            );


            this.allTeachers = [];


            // --------------------------------------------------
            // READ TEACHERS
            // --------------------------------------------------

            if (
              response &&
              response.success &&
              response.departments
            ) {

              Object.keys(
                response.departments
              ).forEach(

                departmentName => {

                  const teachers =
                    response
                      .departments[
                        departmentName
                      ] || [];


                  teachers.forEach(
                    (teacher: any) => {

                      this.allTeachers.push({

                        id: Number(
                          teacher.id
                        ),

                        faculty_id: Number(
                          teacher.faculty_id
                        ),

                        name:
                          teacher.name ??
                          teacher.full_name ??
                          '',

                        abbreviation:
                          teacher.abbreviation ??
                          '',

                        department:
                          teacher.department ??
                          '',

                        can_edit:
                          Number(
                            teacher.can_edit
                          ) === 1 ||
                          teacher.can_edit === true

                      });

                    }
                  );

                }

              );

            }

            else {

              console.error(
                'INVALID TEACHER RESPONSE:',
                response
              );

            }


            console.log(
              'ALL TEACHERS:',
              this.allTeachers
            );


            // --------------------------------------------------
            // STORE EXISTING ACCESS
            // --------------------------------------------------

            this.selectedTeachers =
              this.allTeachers

                .filter(
                  teacher =>
                    teacher.can_edit
                )

                .map(
                  teacher =>
                    teacher.id
                );


            this.originalSelectedTeachers =
              [
                ...this.selectedTeachers
              ];


            // --------------------------------------------------
            // ASSIGN TEACHERS
            // --------------------------------------------------

            this.assignTeachersToDepartments();


            this.loadingTeachers = false;


            this.cdr.detectChanges();


            console.log(
              'FINAL DEPARTMENT GROUPS:',
              this.departments
            );

          });

        },


        error: (error: any) => {

          this.ngZone.run(() => {

            this.loadingTeachers = false;

            console.error(
              'TEACHER API ERROR:',
              error
            );

            this.errorMessage =
              'Failed to load teachers.';

            this.cdr.detectChanges();

          });

        }

      });

  }


  // ============================================================
  // ASSIGN TEACHERS TO DEPARTMENTS
  // ============================================================

  assignTeachersToDepartments(): void {

    console.log(
      '========== ASSIGNING TEACHERS =========='
    );


    // ----------------------------------------------------------
    // CLEAR EXISTING TEACHERS
    // ----------------------------------------------------------

    this.departments.forEach(
      department => {

        department.teachers = [];

      }
    );


    // ----------------------------------------------------------
    // ASSIGN EACH TEACHER
    // ----------------------------------------------------------

    this.allTeachers.forEach(
      teacher => {

        let teacherDepartment =
          teacher.department
            ?.trim()
            .toUpperCase() || '';


        // ------------------------------------------------------
        // CSE & IT → CSE
        // ------------------------------------------------------

        if (
          teacherDepartment === 'CSE & IT'
        ) {

          teacherDepartment = 'CSE';

        }


        // ------------------------------------------------------
        // BIOTECH MAPPING
        // ------------------------------------------------------

        if (
          teacherDepartment === 'BIOTECH' ||
          teacherDepartment === 'BIOTECHNOLOGY'
        ) {

          teacherDepartment = 'BT';

        }


        // ------------------------------------------------------
        // IGNORE IT
        // ------------------------------------------------------

        if (
          teacherDepartment === 'IT'
        ) {

          return;

        }
        

        // ------------------------------------------------------
        // FIND DEPARTMENT
        // ------------------------------------------------------

        const department =
          this.departments.find(
            d =>
              d.abbreviation
                .trim()
                .toUpperCase() ===
              teacherDepartment
          );


        if (!department) {

          console.warn(
            'NO DEPARTMENT BOX FOR:',
            teacher.name,
            '| Department:',
            teacher.department
          );

          return;

        }


        department.teachers.push(
          teacher
        );

      }
    );


    console.log(
      'FINAL DEPARTMENT GROUPS:',
      this.departments
    );


    this.cdr.detectChanges();

  }


  // ============================================================
  // DEPARTMENT CHANGE
  // ============================================================

  onDepartmentChange(): void {

    console.log(
      'DEPARTMENT SELECTED:',
      this.selectedDepartment
    );


    this.teacherSearch = '';

    this.successMessage = '';

    this.errorMessage = '';


    /*
     * No API call is required.
     *
     * Teachers are already loaded.
     *
     * Angular will immediately display the teachers
     * belonging to the selected department.
     */

    this.cdr.detectChanges();

  }


  // ============================================================
  // SELECTED DEPARTMENT OBJECT
  // ============================================================

  get selectedDepartmentObject():
    DepartmentGroup | null {

    if (
      this.selectedDepartment === null
    ) {

      return null;

    }


    return (
      this.departments.find(
        department =>
          department.id ===
          this.selectedDepartment
      ) ?? null
    );

  }


  // ============================================================
  // DISPLAYED TEACHERS
  // ============================================================

  get displayedTeachers(): Teacher[] {

    const department =
      this.selectedDepartmentObject;


    if (!department) {

      return [];

    }


    const search =
      this.teacherSearch
        .trim()
        .toLowerCase();


    if (!search) {

      return department.teachers;

    }


    return department.teachers.filter(
      teacher =>

        teacher.name
          .toLowerCase()
          .includes(search)

        ||

        teacher.abbreviation
          .toLowerCase()
          .includes(search)

        ||

        String(
          teacher.faculty_id
        )
          .toLowerCase()
          .includes(search)

    );

  }


  // ============================================================
  // CHECK TEACHER ACCESS
  // ============================================================

  isSelected(
    teacherId: number
  ): boolean {

    return this.selectedTeachers
      .includes(teacherId);

  }


  // ============================================================
  // TOGGLE TEACHER ACCESS
  // ============================================================

  toggleTeacher(
    teacherId: number
  ): void {

    const index =
      this.selectedTeachers
        .indexOf(teacherId);


    if (
      index === -1
    ) {

      this.selectedTeachers.push(
        teacherId
      );

    }

    else {

      this.selectedTeachers.splice(
        index,
        1
      );

    }


    // ----------------------------------------------------------
    // UPDATE LOCAL TEACHER STATE
    // ----------------------------------------------------------

    const teacher =
      this.allTeachers.find(
        item =>
          item.id === teacherId
      );


    if (teacher) {

      teacher.can_edit =
        this.selectedTeachers
          .includes(teacherId);

    }


    this.successMessage = '';

    this.errorMessage = '';


    this.cdr.detectChanges();

  }


  // ============================================================
  // SAVE ACCESS
  // ============================================================

  saveAccess(): void {

    this.successMessage = '';

    this.errorMessage = '';


    const teachersToRevoke =
      this.originalSelectedTeachers
        .filter(
          id =>
            !this.selectedTeachers
              .includes(id)
        );


    const teachersToGrant =
      this.selectedTeachers
        .filter(
          id =>
            !this.originalSelectedTeachers
              .includes(id)
        );


    console.log(
      'TEACHERS TO GRANT:',
      teachersToGrant
    );


    console.log(
      'TEACHERS TO REVOKE:',
      teachersToRevoke
    );


    // ----------------------------------------------------------
    // NO CHANGES
    // ----------------------------------------------------------

    if (
      teachersToRevoke.length === 0 &&
      teachersToGrant.length === 0
    ) {

      this.successMessage =
        'No changes were made.';

      return;

    }


    this.savingAccess = true;


    // ----------------------------------------------------------
    // GRANT ACCESS
    // ----------------------------------------------------------

    if (
      teachersToGrant.length > 0
    ) {

      this.teacherEditAccessService

        .grantEditAccess(
          teachersToGrant
        )

        .subscribe({

          next: () => {

            this.revokeTeachers(
              teachersToRevoke
            );

          },

          error: (error: any) => {

            this.savingAccess = false;

            console.error(
              'GRANT ACCESS ERROR:',
              error
            );

            this.errorMessage =
              'Failed to grant TT edit access.';

            this.cdr.detectChanges();

          }

        });

    }

    else {

      this.revokeTeachers(
        teachersToRevoke
      );

    }

  }


  // ============================================================
  // REVOKE ACCESS
  // ============================================================

  private revokeTeachers(
    teacherIds: number[]
  ): void {

    if (
      teacherIds.length === 0
    ) {

      this.finishSave();

      return;

    }


    let completed = 0;

    let failed = false;


    teacherIds.forEach(
      userId => {

        this.teacherEditAccessService

          .revokeEditAccess(
            userId
          )

          .subscribe({

            next: () => {

              completed++;


              if (
                completed ===
                teacherIds.length
              ) {

                if (!failed) {

                  this.finishSave();

                }

              }

            },


            error: (error: any) => {

              failed = true;

              this.savingAccess = false;

              console.error(
                'REVOKE ACCESS ERROR:',
                error
              );

              this.errorMessage =
                'Failed to remove some TT edit access.';

              this.cdr.detectChanges();

            }

          });

      }
    );

  }


  // ============================================================
  // FINISH SAVE
  // ============================================================

  private finishSave(): void {

  this.savingAccess = false;

  this.successMessage = 'Updated successfully';

  // ----------------------------------------------------------
  // UPDATE ORIGINAL STATE
  // ----------------------------------------------------------

  this.originalSelectedTeachers = [
    ...this.selectedTeachers
  ];

  // ----------------------------------------------------------
  // UPDATE LOCAL ACCESS STATE
  // ----------------------------------------------------------

  this.allTeachers.forEach(
    teacher => {

      teacher.can_edit =
        this.selectedTeachers.includes(
          teacher.id
        );

    }
  );

  this.cdr.detectChanges();

  // ----------------------------------------------------------
  // RELOAD PAGE AFTER SAVE
  // ----------------------------------------------------------

  setTimeout(() => {
    window.location.reload();
  }, 800);

}


  // ============================================================
  // REMOVE ACCESS
  // ============================================================

  removeAccess(
    teacher: Teacher
  ): void {

    this.successMessage = '';

    this.errorMessage = '';


    this.teacherEditAccessService

      .revokeEditAccess(
        teacher.id
      )

      .subscribe({

        next: (response: any) => {

          if (
            response &&
            response.success
          ) {

            const index =
              this.selectedTeachers
                .indexOf(
                  teacher.id
                );


            if (
              index !== -1
            ) {

              this.selectedTeachers
                .splice(
                  index,
                  1
                );

            }


            teacher.can_edit = false;


            const originalIndex =
              this.originalSelectedTeachers
                .indexOf(
                  teacher.id
                );


            if (
              originalIndex !== -1
            ) {

              this.originalSelectedTeachers
                .splice(
                  originalIndex,
                  1
                );

            }


            this.successMessage =
              `${teacher.name} no longer has TT edit access.`;


            this.cdr.detectChanges();

          }

        },


        error: (error: any) => {

          console.error(
            'REMOVE ACCESS ERROR:',
            error
          );

          this.errorMessage =
            'Failed to remove TT edit access.';

          this.cdr.detectChanges();

        }

      });

  }

// ============================================================
// DEPARTMENT-WISE SELECTED TEACHER COUNT
// ============================================================

getSelectedTeacherCount(
  department: DepartmentGroup
): number {

  return department.teachers.filter(
    teacher =>
      this.selectedTeachers.includes(
        teacher.id
      )
  ).length;

}

}