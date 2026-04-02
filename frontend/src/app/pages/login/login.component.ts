import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { resolveApiUrl } from '../../services/api.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  twoFaForm: FormGroup;
  step = 1; // 1: Credentials, 2: 2FA TOTP or Login
  isLoading = false;
  errorMessage = '';
  infoMessage = '';
  isInitialLoading = true;
  isDbOffline = false;
  twoFactorRequired = false;
  trustDeviceForm: FormGroup;
  deviceId = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.twoFaForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(8)]]
    });

    this.trustDeviceForm = this.fb.group({
      trustDevice: [false]
    });

    // Generate device ID
    this.deviceId = this.generateDeviceId();
  }

  ngOnInit() {
    this.http.get(resolveApiUrl('/status')).subscribe({
      next: () => {
        this.isInitialLoading = false;
      },
      error: () => {
        this.isInitialLoading = false;
        this.isDbOffline = true;
      }
    });
  }

  generateDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  retryConnection() {
    this.isInitialLoading = true;
    this.isDbOffline = false;
    this.ngOnInit();
  }

  onLogin() {
    if (this.loginForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.isLoading = false;
        
        // If 2FA not enabled, login directly
        if (!res.twoFactorEnabled) {
          this.authService.saveToken(res.token);
          this.router.navigate(['/dashboard']);
        } else {
          // If 2FA enabled, show TOTP verification
          this.twoFactorRequired = true;
          this.step = 2;
          this.infoMessage = res.message || 'Insere o codigo do teu Authenticator.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Erro ao efetuar login.';
      }
    });
  }

  onVerifyTOTP() {
    if (this.twoFaForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    const data = {
      email: this.loginForm.value.email,
      code: this.twoFaForm.value.code,
      deviceId: this.deviceId,
      trustDevice: this.trustDeviceForm.value.trustDevice
    };

    this.http.post(resolveApiUrl('/auth/verify-2fa'), data).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.authService.saveToken(res.token);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Codigo invalido ou backup code expirado.';
      }
    });
  }

  onResendCode() {
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    this.http.post(resolveApiUrl('/auth/resend-2fa'), { email: this.loginForm.value.email }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.infoMessage = res.message || 'Novo código enviado.';

        if (res.devCode) {
          this.twoFaForm.patchValue({ code: res.devCode });
          this.infoMessage = `SMTP não configurado. Novo código local: ${res.devCode}`;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Erro ao reenviar código.';
      }
    });
  }
}
