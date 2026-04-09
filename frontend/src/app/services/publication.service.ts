import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { resolveApiUrl } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class PublicationService {
  private apiUrl = resolveApiUrl('/posts');

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getAuthHeaders() {
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
      })
    };
  }

  getPublications(filters: { type?: string; zone?: string; status?: string; q?: string } = {}): Observable<any[]> {
    let params = new HttpParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params = params.set(key, value);
      }
    });

    return this.http.get<any[]>(this.apiUrl, { params });
  }

  createPublication(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data, this.getAuthHeaders());
  }

  getMyPublications(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mine`, this.getAuthHeaders());
  }

  getMyPublication(publicationId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mine/${publicationId}`, this.getAuthHeaders());
  }

  updatePublicationStatus(publicationId: string, status: string): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${publicationId}/status`,
      { status },
      this.getAuthHeaders()
    );
  }

  updatePublication(publicationId: string, data: any): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/${publicationId}`,
      data,
      this.getAuthHeaders()
    );
  }
}
