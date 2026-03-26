import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  isLoading = false;
  message = '';
  isSuccess = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      // Simple 9-digit NIF validation for Portugal
      nif: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
      rgpdConsent: [false, Validators.requiredTrue]
    });
  }

  onRegister() {
    if (this.registerForm.invalid) {
      this.message = 'Preencha todos os campos corretamente e aceite a política RGPD.';
      this.isSuccess = false;
      return;
    }

    this.isLoading = true;
    this.message = '';

    this.authService.register(this.registerForm.value).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.isSuccess = true;
        this.message = res.message; // Let them know to check email
        
        // We'll redirect to login after 3 seconds so they enter code there
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.isSuccess = false;
        this.message = err.error.message || 'Ocorreu um erro no registo.';
      }
    });
  }
}
