import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <nav
      class="border-b border-slate-200 bg-white shadow-sm"
    >
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3"
      >
        <a routerLink="/releases" class="text-lg font-semibold text-slate-800">
          Release Approval
        </a>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          @if (auth.isAuthenticated()) {
            <a
              routerLink="/releases"
              class="rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
              >Releases</a
            >
            <a
              routerLink="/releases/new"
              class="rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
              >Nuevo release</a
            >
            @if (auth.isAdmin()) {
              <a
                routerLink="/admin/dashboard"
                class="rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
                >Admin</a
              >
            }
            <button
              type="button"
              class="rounded bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-900"
              (click)="auth.logout()"
            >
              Cerrar sesión
            </button>
          } @else {
            <a
              routerLink="/login"
              class="rounded bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-900"
              >Iniciar sesión</a
            >
          }
        </div>
      </div>
    </nav>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
