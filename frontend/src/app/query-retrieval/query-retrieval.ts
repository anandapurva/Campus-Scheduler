import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-query-retrieval',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './query-retrieval.html',
  styleUrl: './query-retrieval.css'
})
export class QueryRetrievalComponent {

  // ==========================================================
  // QUERY
  // ==========================================================

  query: string = '';


  // ==========================================================
  // RESULTS
  // ==========================================================

  results: any[] = [];

  resultType: string = '';

  resultCount: number = 0;


  // ==========================================================
  // UI STATE
  // ==========================================================

  loading: boolean = false;

  errorMessage: string = '';


  // ==========================================================
  // CONSTRUCTOR
  // ==========================================================

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}


  // ==========================================================
  // RUN QUERY
  // ==========================================================

  runQuery(): void {

    if (!this.query.trim()) {

      this.errorMessage =
        'Please enter a question.';

      return;

    }


    this.loading = true;

    this.errorMessage = '';

    this.results = [];

    this.resultType = '';

    this.resultCount = 0;


    console.log(
      'SENDING QUERY:',
      this.query
    );


    this.http.post<any>(
      'http://localhost:5000/api/query',
      {
        query: this.query.trim()
      }
    )
    .subscribe({

      // ======================================================
      // SUCCESS
      // ======================================================

      next: (response) => {

        console.log(
          '===================================='
        );

        console.log(
          'FRONTEND RESPONSE:',
          response
        );

        console.log(
          '===================================='
        );


        this.loading = false;


        // ====================================================
        // CHECK RESPONSE
        // ====================================================

        if (
          response &&
          response.success !== false
        ) {

          // --------------------------------------------------
          // DATA
          // --------------------------------------------------

          this.results =
            Array.isArray(response.data)
              ? response.data
              : [];


          // --------------------------------------------------
          // TYPE
          // --------------------------------------------------

          this.resultType =
            String(
              response.type || ''
            )
            .toLowerCase()
            .trim();


          // --------------------------------------------------
          // COUNT
          // --------------------------------------------------

          this.resultCount =
            typeof response.count === 'number'
              ? response.count
              : this.results.length;


          // --------------------------------------------------
          // MESSAGE
          // --------------------------------------------------

          if (
            response.message &&
            this.resultCount === 0
          ) {

            this.errorMessage =
              response.message;

          }

          else {

            this.errorMessage = '';

          }


          // --------------------------------------------------
          // DEBUG
          // --------------------------------------------------

          console.log(
            'RESULT TYPE:',
            this.resultType
          );

          console.log(
            'RESULT COUNT:',
            this.resultCount
          );

          console.log(
            'RESULTS:',
            this.results
          );


          // --------------------------------------------------
          // CHANGE DETECTION
          // --------------------------------------------------

          this.cdr.detectChanges();

        }

        else {

          this.results = [];

          this.resultType = '';

          this.resultCount = 0;

          this.errorMessage =
            response?.message ||
            'Unable to process query.';

          this.cdr.detectChanges();

        }

      },


      // ======================================================
      // HTTP ERROR
      // ======================================================

      error: (error) => {

        console.error(
          'FRONTEND QUERY ERROR:',
          error
        );


        this.loading = false;

        this.results = [];

        this.resultType = '';

        this.resultCount = 0;


        if (
          error?.error?.message
        ) {

          this.errorMessage =
            error.error.message;

        }

        else if (
          error?.status === 0
        ) {

          this.errorMessage =
            'Unable to connect to the server. Make sure the backend is running on port 5000.';

        }

        else {

          this.errorMessage =
            'Unable to process the query. Please try again.';

        }


        this.cdr.detectChanges();

      },


      // ======================================================
      // COMPLETE
      // ======================================================

      complete: () => {

        console.log(
          'QUERY REQUEST COMPLETED'
        );

        this.loading = false;

        this.cdr.detectChanges();

      }

    });

  }


  // ==========================================================
  // USE EXAMPLE
  // ==========================================================

  useExample(
    example: string
  ): void {

    this.query = example;

    this.runQuery();

  }


  // ==========================================================
  // DISPLAY RESULT TYPE
  // ==========================================================

  getDisplayType(): string {

    switch (
      this.resultType
    ) {

      case 'faculty':
      case 'teacher':
        return 'FACULTY';


      case 'rooms':
      case 'room':
        return 'ROOMS';


      case 'subjects':
      case 'subject':
        return 'SUBJECTS';


      case 'semesters':
      case 'semester':
        return 'SEMESTERS';


      case 'timetable':
        return 'TIMETABLE';


      default:

        return (
          this.resultType
            ? this.resultType.toUpperCase()
            : 'RESULTS'
        );

    }

  }


  // ==========================================================
  // ROOM TYPE
  // ==========================================================

  getRoomType(
    type: string
  ): string {

    switch (
      String(type || '').toUpperCase()
    ) {

      case 'L':
        return 'Lecture';


      case 'T':
        return 'Tutorial';


      case 'P':
        return 'Practical';


      default:
        return type || 'Room';

    }

  }


  // ==========================================================
  // ROOM ICON
  // ==========================================================

  getRoomIcon(
    type: string
  ): string {

    switch (
      String(type || '').toUpperCase()
    ) {

      case 'L':
        return '▣';


      case 'T':
        return '▤';


      case 'P':
        return '⚙';


      default:
        return '▣';

    }

  }


  // ==========================================================
  // FORMAT FIELD NAME
  // ==========================================================

 formatFieldName(field: string | number | symbol): string {
  if (field === null || field === undefined) {
    return '';
  }

  return String(field)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

  // ==========================================================
  // CLEAR QUERY
  // ==========================================================

  clearQuery(): void {

    this.query = '';

    this.results = [];

    this.resultType = '';

    this.resultCount = 0;

    this.errorMessage = '';

    this.loading = false;

    this.cdr.detectChanges();

  }

}