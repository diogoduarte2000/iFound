import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  step = 1;
  emailForm: FormGroup;
  resetForm: FormGroup;
  
  isLoading = false;
  errorMessage = '';
  infoMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.pattern('^[0-9]+$')]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onRequestCode() {
    if (this.emailForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    const payload = this.emailForm.value;

    this.http.post<{message: string; deliveryMode?: string; devCode?: string}>(`http://localhost:5000/api/auth/forgot-password`, payload)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.infoMessage = res.message;
          if (res.deliveryMode === 'dev' && res.devCode) {
            this.infoMessage += ` (DEV MODE CODE: ${res.devCode})`;
          }
          this.step = 2;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Ocorreu um erro ao processar o seu pedido.';
        }
      });
  }

  onResetPassword() {
    if (this.resetForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    const payload = {
      email: this.emailForm.value.email,
      code: this.resetForm.value.code,
      newPassword: this.resetForm.value.newPassword
    };

    this.http.post<{message: string}>(`http://localhost:5000/api/auth/reset-password`, payload)
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.infoMessage = res.message;
          // Redireciona para o login após 2 segundos
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Código inválido ou palavra-passe fraca.';
        }
      });
  }
}
