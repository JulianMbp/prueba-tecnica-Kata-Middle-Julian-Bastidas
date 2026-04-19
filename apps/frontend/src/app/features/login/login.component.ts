import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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
      class="flex min-h-[calc(100vh-6rem)] w-full items-center justify-center px-4"
    >
      <div
        class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg"
      >
        <h1 class="mb-6 text-center text-xl font-semibold text-slate-900">
          Iniciar sesión
        </h1>

        @if (error()) {
          <p
            class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700"
            role="alert"
          >
            {{ error() }}
          </p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label for="login-email" class="text-sm font-medium text-slate-700"
              >Email</label
            >
            <input
              id="login-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              [class.border-red-400]="
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

          <div class="flex flex-col gap-1">
            <label
              for="login-password"
              class="text-sm font-medium text-slate-700"
              >Contraseña</label
            >
            <input
              id="login-password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              [class.border-red-400]="
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
            class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        next: () => void this.router.navigateByUrl('/releases'),
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
