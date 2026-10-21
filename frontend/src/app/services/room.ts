import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RoomService {

  private apiUrl =
    'http://localhost:5000/api/rooms';


  constructor(
    private http: HttpClient
  ) {}


  // ==========================================
  // PREVIEW CSV
  // ==========================================

  previewCSV(file: File): Observable<any> {

    const formData =
      new FormData();

    formData.append(
      'file',
      file
    );

    return this.http.post(
      `${this.apiUrl}/preview`,
      formData
    );

  }


  // ==========================================
  // IMPORT
  // ==========================================

  importRooms(
    data: any[]
  ): Observable<any> {

    return this.http.post(
      `${this.apiUrl}/import`,
      {
        data
      }
    );

  }


  // ==========================================
  // GET ROOMS
  // ==========================================

  getRooms(): Observable<any[]> {

    return this.http.get<any[]>(
      this.apiUrl
    );

  }

  // ==========================================
  // ADD ROOM
  // ==========================================

  addRoom(room: any): Observable<any> {
    return this.http.post(
      this.apiUrl,
      room
    );
  }


  // ==========================================
  // UPDATE ROOM
  // ==========================================

  updateRoom(id: number, room: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/${id}`,
      room
    );
  }


  // ==========================================
  // DELETE ROOM
  // ==========================================

  deleteRoom(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${id}`
    );
  }

}