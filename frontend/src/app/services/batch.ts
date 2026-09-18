import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

export interface Batch {
  id: number;
  batch_code: string;
  program: string;
  batch_type: string;
  enrollment_year: number;
  department: string;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BatchResponse {
  success: boolean;
  count: number;
  batches: Batch[];
}

export interface BatchPreviewRow extends Batch {
  row: number;
  valid: boolean;
  errors: string[];
}

export interface BatchPreviewResponse {
  success: boolean;
  total: number;
  valid: number;
  invalid: number;
  errors: any[];
  data: BatchPreviewRow[];
}

export interface BatchImportResponse {
  success: boolean;
  message: string;
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

@Injectable({
  providedIn: 'root'
})
export class BatchService {

  private apiUrl =
    'http://localhost:5000/api/batches';

  constructor(
    private http: HttpClient
  ) {}

  getBatches(): Observable<BatchResponse> {
    return this.http.get<BatchResponse>(
      this.apiUrl
    );
  }

  getBatch(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/${id}`
    );
  }

  addBatch(data: any): Observable<any> {
    return this.http.post(
      this.apiUrl,
      data
    );
  }

  updateBatch(
    id: number,
    data: any
  ): Observable<any> {

    return this.http.put(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  deleteBatch(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`
    );
  }

  previewCSV(
    file: File
  ): Observable<BatchPreviewResponse> {

    const formData = new FormData();

    formData.append(
      'file',
      file
    );

    return this.http.post<BatchPreviewResponse>(
      `${this.apiUrl}/preview`,
      formData
    );
  }

  importBatches(
    file: File
  ): Observable<BatchImportResponse> {

    const formData = new FormData();

    formData.append(
      'file',
      file
    );

    return this.http.post<BatchImportResponse>(
      `${this.apiUrl}/import`,
      formData
    );
  }

  getEligibleBatches(
    program: string,
    semester: number,
    department: string,
    academicSessionStartYear: number
  ): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/eligible`,
      {
        params: {
          program,
          semester: semester.toString(),
          department,
          academicSessionStartYear:
            academicSessionStartYear.toString()
        }
      }
    );
  }

getLunchForBatch(
  batchId: number,
  academicSessionStartYear: number
): Observable<any> {

  const params = {
    batchId: batchId.toString(),
    academicSessionStartYear:
      academicSessionStartYear.toString()
  };

  return this.http.get(
    'http://localhost:5000/api/timetable-config/lunch/batch',
    { params }
  );
}
}