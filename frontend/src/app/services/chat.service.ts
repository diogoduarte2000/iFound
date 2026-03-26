import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:5000/api/chats';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.authService.getToken()}`
      })
    };
  }

  getConversations(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, this.getAuthHeaders());
  }

  openConversation(publicationId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/open`, { publicationId }, this.getAuthHeaders());
  }

  getConversation(chatId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${chatId}`, this.getAuthHeaders());
  }

  sendMessage(chatId: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${chatId}/messages`, payload, this.getAuthHeaders());
  }

  resolveAttachmentUrl(url: string): string {
    const token = this.authService.getToken();
    const resolvedUrl = url.startsWith('http') ? url : `http://localhost:5000${url}`;
    return token ? `${resolvedUrl}?token=${encodeURIComponent(token)}` : resolvedUrl;
  }
}
