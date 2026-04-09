import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { resolveApiUrl, resolveBackendUrl } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = resolveApiUrl('/chats');

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

  openRealtimeStream(handlers: {
    connected?: (payload: any) => void;
    chatUpdated?: (payload: any) => void;
    error?: () => void;
  }): EventSource | null {
    const token = this.authService.getToken();
    if (!token) {
      return null;
    }

    const streamUrl = `${resolveBackendUrl('/api/chats/stream')}?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('connected', (event) => {
      handlers.connected?.(JSON.parse((event as MessageEvent).data));
    });

    eventSource.addEventListener('chat-updated', (event) => {
      handlers.chatUpdated?.(JSON.parse((event as MessageEvent).data));
    });

    eventSource.onerror = () => {
      handlers.error?.();
    };

    return eventSource;
  }

  resolveAttachmentUrl(url: string): string {
    const token = this.authService.getToken();
    const resolvedUrl = resolveBackendUrl(url);
    if (!token) {
      return resolvedUrl;
    }

    const separator = resolvedUrl.includes('?') ? '&' : '?';
    return `${resolvedUrl}${separator}token=${encodeURIComponent(token)}`;
  }
}
