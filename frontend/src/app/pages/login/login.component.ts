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
  step = 1; // 1: Credentials, 2: 2FA
  isLoading = false;
  errorMessage = '';
  infoMessage = '';
  isInitialLoading = true;
  isDbOffline = false;

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
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
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
        this.step = 2; // Advance to 2FA
        this.infoMessage = res.message || '';

        if (res.devCode) {
          this.twoFaForm.patchValue({ code: res.devCode });
          this.infoMessage = `SMTP nao configurado. Codigo local: ${res.devCode}`;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Erro ao efetuar login.';
      }
    });
  }

  onVerify() {
    if (this.twoFaForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    const data = {
      email: this.loginForm.value.email,
      code: this.twoFaForm.value.code
    };

    this.authService.verify2fa(data).subscribe({
      next: (res) => {
        this.authService.saveToken(res.token);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Falha ao verificar o código.';
      }
    });
  }
}
