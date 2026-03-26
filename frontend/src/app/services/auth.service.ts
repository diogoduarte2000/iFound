import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api/auth';

  constructor(private http: HttpClient) { }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials);
  }

  verify2fa(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-2fa`, data);
  }

  saveToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getTokenPayload(): { id: string; email: string; exp?: number } | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  private isTokenExpired(payload: { exp?: number } | null): boolean {
    if (!payload?.exp) {
      return true;
    }

    return payload.exp * 1000 <= Date.now();
  }

  getCurrentUser(): { id: string; email: string } | null {
    const payload = this.getTokenPayload();
    if (!payload || this.isTokenExpired(payload)) {
      return null;
    }

    return { id: payload.id, email: payload.email };
  }

  isLoggedIn(): boolean {
    const payload = this.getTokenPayload();

    if (!payload || this.isTokenExpired(payload)) {
      this.logout();
      return false;
    }

    return true;
  }

  logout() {
    localStorage.removeItem('auth_token');
  }
}
