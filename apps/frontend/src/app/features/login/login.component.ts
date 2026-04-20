import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div
      class="flex min-h-[calc(100vh-5.5rem)] w-full items-center justify-center px-4 py-8"
    >
      <div class="app-card w-full max-w-md p-8 sm:p-10">
        <div class="mb-8 text-center">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-soft"
            aria-hidden="true"
          >
            RA
          </div>
          <h1 class="page-title text-xl sm:text-2xl">Iniciar sesión</h1>
          <p class="page-subtitle mt-2">
            Accede para gestionar solicitudes de release.
          </p>
        </div>

        @if (error()) {
          <div
            class="mb-6 flex items-start gap-3 rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <svg
              class="mt-0.5 h-5 w-5 shrink-0 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{{ error() }}</span>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-5">
          <div class="flex flex-col gap-1.5">
            <label for="login-email" class="app-label">Email</label>
            <input
              id="login-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              class="app-input"
              [class.border-red-300]="
                form.controls.email.invalid && form.controls.email.touched
              "
            />
            @if (
              form.controls.email.touched && form.controls.email.errors?.['required']
            ) {
              <span class="text-xs text-red-600">El email es obligatorio</span>
            }
            @if (form.controls.email.touched && form.controls.email.errors?.['email']) {
              <span class="text-xs text-red-600">Introduce un email válido</span>
            }
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="login-password" class="app-label">Contraseña</label>
            <input
              id="login-password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="app-input"
              [class.border-red-300]="
                form.controls.password.invalid && form.controls.password.touched
              "
            />
            @if (
              form.controls.password.touched &&
              form.controls.password.errors?.['required']
            ) {
              <span class="text-xs text-red-600">La contraseña es obligatoria</span>
            }
          </div>

          <button
            type="submit"
            class="btn-primary mt-1 w-full py-3"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span
                class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden="true"
              ></span>
              <span>Entrando…</span>
            } @else {
              Entrar
            }
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    // Si el estado auth cambia a true, forzamos salida de /login.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.router.navigate(['/releases'], { replaceUrl: true });
      }
    });
  }

  submit(): void {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.loading.set(true);

    this.auth
      .login(email, password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigate(['/releases'], { replaceUrl: true }),
        error: (err: HttpErrorResponse) => {
          if (err.status === 401) {
            this.error.set('Credenciales inválidas');
          } else {
            this.error.set('No se pudo iniciar sesión. Inténtalo de nuevo.');
          }
        },
      });
  }
}
