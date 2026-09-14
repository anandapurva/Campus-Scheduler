import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  finalize
} from 'rxjs';

import {
  BatchService,
  Batch,
  BatchPreviewRow
} from '../../../services/batch';


@Component({
  selector: 'app-batch-management',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './batch-management.html',
  styleUrls: ['./batch-management.css']
})
export class BatchManagement
  implements OnInit {

  /* =====================================================
     DATA
  ===================================================== */

  batches: Batch[] = [];

  filteredBatches: Batch[] = [];

  /* =====================================================
     LOADING
  ===================================================== */

  isLoading = false;

  isImporting = false;

  /* =====================================================
     CSV
  ===================================================== */

  selectedFile: File | null = null;

  previewData: BatchPreviewRow[] = [];

  previewTotal = 0;

  previewValid = 0;

  previewInvalid = 0;

  showPreview = false;

  importResult: any = null;

  /* =====================================================
     SEARCH
  ===================================================== */

  searchTerm = '';

  selectedProgramFilter = '';

  selectedBatchTypeFilter = '';

  /* =====================================================
     PAGINATION
  ===================================================== */

  currentPage = 1;

  pageSize = 10;

  totalPages = 1;

  /* =====================================================
     FORM
  ===================================================== */

  showBatchForm = false;

  isEditing = false;

  editingBatchId: number | null = null;

  batchForm = {
    batch_code: '',
    program: 'BTECH',
    batch_type: 'Regular',
    enrollment_year: new Date().getFullYear(),
    department: ''
  };

  /* =====================================================
     DROPDOWNS
  ===================================================== */

  programs = [
    'BTECH',
    'MTECH'
  ];

  batchTypes = [
    'Regular',
    'Integrated'
  ];

  /* =====================================================
     TOAST
  ===================================================== */

  toastMessage = '';

  toastType:
    'success' |
    'error' |
    'info' = 'success';

  showToast = false;

  private toastTimer: any;

  constructor(
    private batchService: BatchService,
    private cdr: ChangeDetectorRef
  ) {}

  /* =====================================================
     INIT
  ===================================================== */

  ngOnInit(): void {
    this.loadBatches();
  }

  /* =====================================================
     LOAD BATCHES
  ===================================================== */

  loadBatches(): void {

    this.isLoading = true;

    this.batchService
      .getBatches()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: response => {

          this.batches =
            response.batches || [];

          this.applyFilters();
        },

        error: error => {

          console.error(
            'Failed to load batches:',
            error
          );

          this.showToastMessage(
            error?.error?.message ||
            'Failed to load batches',
            'error'
          );
        }

      });
  }

  /* =====================================================
     SEARCH + FILTER
  ===================================================== */

  applyFilters(): void {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();

    this.filteredBatches =
      this.batches.filter(batch => {

        const matchesSearch =
          !search ||
          batch.batch_code
            .toLowerCase()
            .includes(search) ||
          batch.program
            .toLowerCase()
            .includes(search) ||
          batch.department
            .toLowerCase()
            .includes(search) ||
          batch.batch_type
            .toLowerCase()
            .includes(search);

        const matchesProgram =
          !this.selectedProgramFilter ||
          batch.program ===
            this.selectedProgramFilter;

        const matchesType =
          !this.selectedBatchTypeFilter ||
          batch.batch_type ===
            this.selectedBatchTypeFilter;

        return (
          matchesSearch &&
          matchesProgram &&
          matchesType
        );
      });

    this.currentPage = 1;

    this.updatePagination();
  }

  /* =====================================================
     PAGINATION
  ===================================================== */

  updatePagination(): void {

    this.totalPages =
      Math.max(
        1,
        Math.ceil(
          this.filteredBatches.length /
          this.pageSize
        )
      );

    if (
      this.currentPage >
      this.totalPages
    ) {
      this.currentPage =
        this.totalPages;
    }
  }

  get paginatedBatches(): Batch[] {

    const start =
      (this.currentPage - 1) *
      this.pageSize;

    const end =
      start + this.pageSize;

    return this.filteredBatches.slice(
      start,
      end
    );
  }

  previousPage(): void {

    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {

    if (
      this.currentPage <
      this.totalPages
    ) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {

    if (
      page >= 1 &&
      page <= this.totalPages
    ) {
      this.currentPage = page;
    }
  }

  get pageNumbers(): number[] {

    return Array.from(
      { length: this.totalPages },
      (_, index) => index + 1
    );
  }

  /* =====================================================
     FILE SELECT
  ===================================================== */

  onFileSelected(
    event: Event
  ): void {

    const input =
      event.target as HTMLInputElement;

    if (
      !input.files ||
      input.files.length === 0
    ) {
      return;
    }

    const file =
      input.files[0];

    if (
      !file.name
        .toLowerCase()
        .endsWith('.csv')
    ) {

      this.showToastMessage(
        'Please select a CSV file',
        'error'
      );

      input.value = '';

      return;
    }

    this.selectedFile = file;

    this.previewData = [];

    this.previewTotal = 0;

    this.previewValid = 0;

    this.previewInvalid = 0;

    this.showPreview = false;

    this.importResult = null;
  }

  /* =====================================================
     PREVIEW CSV
  ===================================================== */

  previewCSV(): void {

    if (!this.selectedFile) {

      this.showToastMessage(
        'Please select a CSV file first',
        'error'
      );

      return;
    }

    this.batchService
      .previewCSV(
        this.selectedFile
      )
      .subscribe({

        next: response => {

          this.previewData =
            response.data || [];

          this.previewTotal =
            response.total || 0;

          this.previewValid =
            response.valid || 0;

          this.previewInvalid =
            response.invalid || 0;

          this.showPreview = true;

          this.showToastMessage(
            'CSV preview generated successfully',
            'success'
          );

          this.cdr.detectChanges();
        },

        error: error => {

          console.error(
            'CSV preview error:',
            error
          );

          this.showPreview = false;

          this.showToastMessage(
            error?.error?.message ||
            'Failed to preview CSV',
            'error'
          );
        }

      });
  }

  /* =====================================================
     IMPORT CSV
  ===================================================== */

  importCSV(): void {

    if (!this.selectedFile) {

      this.showToastMessage(
        'Please select a CSV file',
        'error'
      );

      return;
    }

    if (
      this.previewInvalid > 0
    ) {

      this.showToastMessage(
        'Please fix invalid rows before importing',
        'error'
      );

      return;
    }

    this.isImporting = true;

    this.batchService
      .importBatches(
        this.selectedFile
      )
      .pipe(
        finalize(() => {

          this.isImporting = false;

          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: response => {

          this.importResult =
            response;

          this.showToastMessage(
            response.message ||
            'Batch import completed successfully',
            'success'
          );

          this.loadBatches();

          this.resetCSV();
        },

        error: error => {

          console.error(
            'Batch import error:',
            error
          );

          this.showToastMessage(
            error?.error?.message ||
            'Failed to import batches',
            'error'
          );
        }

      });
  }

  /* =====================================================
     RESET CSV
  ===================================================== */

  resetCSV(): void {

    this.selectedFile = null;

    this.previewData = [];

    this.previewTotal = 0;

    this.previewValid = 0;

    this.previewInvalid = 0;

    this.showPreview = false;
  }

  /* =====================================================
     ADD
  ===================================================== */

  openAddForm(): void {

    this.isEditing = false;

    this.editingBatchId = null;

    this.batchForm = {
      batch_code: '',
      program: 'BTECH',
      batch_type: 'Regular',
      enrollment_year:
        new Date().getFullYear(),
      department: ''
    };

    this.showBatchForm = true;
  }

  /* =====================================================
     EDIT
  ===================================================== */

  editBatch(batch: Batch): void {

    this.isEditing = true;

    this.editingBatchId =
      batch.id;

    this.batchForm = {
      batch_code:
        batch.batch_code,

      program:
        batch.program,

      batch_type:
        batch.batch_type,

      enrollment_year:
        Number(batch.enrollment_year),

      department:
        batch.department
    };

    this.showBatchForm = true;
  }

  /* =====================================================
     CLOSE FORM
  ===================================================== */

  closeBatchForm(): void {

    this.showBatchForm = false;

    this.isEditing = false;

    this.editingBatchId = null;
  }

  /* =====================================================
     SAVE
  ===================================================== */

  saveBatch(): void {

    if (
      !this.batchForm.batch_code.trim()
    ) {

      this.showToastMessage(
        'Batch code is required',
        'error'
      );

      return;
    }

    if (
      !this.batchForm.program
    ) {

      this.showToastMessage(
        'Program is required',
        'error'
      );

      return;
    }

    if (
      !this.batchForm.batch_type
    ) {

      this.showToastMessage(
        'Batch type is required',
        'error'
      );

      return;
    }

    if (
      !this.batchForm.enrollment_year
    ) {

      this.showToastMessage(
        'Enrollment year is required',
        'error'
      );

      return;
    }

    if (
      !this.batchForm.department.trim()
    ) {

      this.showToastMessage(
        'Department is required',
        'error'
      );

      return;
    }

    const payload = {
      batch_code:
        this.batchForm.batch_code.trim(),

      program:
        this.batchForm.program,

      batch_type:
        this.batchForm.batch_type,

      enrollment_year:
        Number(
          this.batchForm.enrollment_year
        ),

      department:
        this.batchForm.department.trim()
    };

    if (
      this.isEditing &&
      this.editingBatchId
    ) {

      this.batchService
        .updateBatch(
          this.editingBatchId,
          payload
        )
        .subscribe({

          next: response => {

            this.showToastMessage(
              response?.message ||
              'Batch updated successfully',
              'success'
            );

            this.closeBatchForm();

            this.loadBatches();
          },

          error: error => {

            console.error(
              'Update batch error:',
              error
            );

            this.showToastMessage(
              error?.error?.message ||
              'Failed to update batch',
              'error'
            );
          }

        });

    } else {

      this.batchService
        .addBatch(payload)
        .subscribe({

          next: response => {

            this.showToastMessage(
              response?.message ||
              'Batch added successfully',
              'success'
            );

            this.closeBatchForm();

            this.loadBatches();
          },

          error: error => {

            console.error(
              'Add batch error:',
              error
            );

            this.showToastMessage(
              error?.error?.message ||
              'Failed to add batch',
              'error'
            );
          }

        });
    }
  }

  /* =====================================================
     DELETE
  ===================================================== */

  deleteBatch(batch: Batch): void {

    if (
      !confirm(
        `Are you sure you want to delete batch "${batch.batch_code}"?`
      )
    ) {
      return;
    }

    this.batchService
      .deleteBatch(batch.id)
      .subscribe({

        next: response => {

          this.showToastMessage(
            response?.message ||
            'Batch deleted successfully',
            'success'
          );

          this.loadBatches();
        },

        error: error => {

          console.error(
            'Delete batch error:',
            error
          );

          this.showToastMessage(
            error?.error?.message ||
            'Failed to delete batch',
            'error'
          );
        }

      });
  }

  /* =====================================================
     TOAST
  ===================================================== */

  showToastMessage(
    message: string,
    type:
      'success' |
      'error' |
      'info' = 'success'
  ): void {

    this.toastMessage = message;

    this.toastType = type;

    this.showToast = true;

    clearTimeout(
      this.toastTimer
    );

    this.toastTimer =
      setTimeout(() => {

        this.showToast = false;

        this.cdr.detectChanges();

      }, 4000);
  }

  closeToast(): void {

    this.showToast = false;

    clearTimeout(
      this.toastTimer
    );
  }

  /* =====================================================
     HELPERS
  ===================================================== */

  getProgramLabel(
    program: string
  ): string {

    if (program === 'BTECH') {
      return 'B.Tech';
    }

    if (program === 'MTECH') {
      return 'M.Tech';
    }

    return program;
  }
}