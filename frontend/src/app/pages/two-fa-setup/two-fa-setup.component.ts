import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { resolveApiUrl } from '../../services/api.config';

@Component({
  selector: 'app-two-fa-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './two-fa-setup.component.html',
  styleUrls: ['./two-fa-setup.component.scss']
})
export class TwoFASetupComponent implements OnInit {
  setupForm: FormGroup;
  qrCode: string | null = null;
  manualKey: string | null = null;
  step: 'initial' | 'verify' | 'backup' = 'initial';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  backupCodes: string[] = [];
  backupCodesCopied = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.setupForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  ngOnInit() {
    this.startSetup();
  }

  startSetup() {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get(resolveApiUrl('/auth/2fa/setup')).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.qrCode = res.qrCode;
        this.manualKey = res.manualEntryKey;
        this.step = 'verify';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Erro ao iniciar setup 2FA.';
      }
    });
  }

  verifyCode() {
    if (this.setupForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      code: this.setupForm.value.code
    };

    this.http.post(resolveApiUrl('/auth/2fa/enable'), payload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.successMessage = 'Autenticacao de dois fatores ativada com sucesso!';
        this.backupCodes = res.backupCodes;
        this.step = 'backup';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error.message || 'Codigo invalido, tenta outra vez.';
      }
    });
  }

  copyBackupCodes() {
    const text = this.backupCodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.backupCodesCopied = true;
      setTimeout(() => {
        this.backupCodesCopied = false;
      }, 2000);
    });
  }

  downloadBackupCodes() {
    const text = this.backupCodes.join('\n');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', 'ifound-backup-codes.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
}
