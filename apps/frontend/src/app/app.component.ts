import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-nav backdrop-blur-md">
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5"
      >
        <a
          routerLink="/releases"
          class="group flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 transition hover:text-brand-700"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-soft"
            aria-hidden="true"
            >RA</span
          >
          <span>Release Approval</span>
        </a>
        <div class="flex flex-wrap items-center gap-1.5 text-sm">
          @if (auth.isAuthenticated()) {
            <a
              routerLink="/releases"
              routerLinkActive="nav-link-active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-link"
              >Releases</a
            >
            <a
              routerLink="/releases/new"
              routerLinkActive="nav-link-active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-link"
              >Nuevo release</a
            >
            @if (auth.isAdmin()) {
              <a
                routerLink="/admin/dashboard"
                routerLinkActive="nav-link-active"
                [routerLinkActiveOptions]="{ exact: true }"
                class="nav-link"
                >Admin</a
              >
            }
            <button
              type="button"
              class="btn-secondary ml-1 border-0 bg-slate-900 px-3 py-2 text-white hover:bg-slate-800"
              (click)="auth.logout()"
            >
              Cerrar sesión
            </button>
          } @else {
            <a routerLink="/login" class="btn-primary px-5 py-2">Iniciar sesión</a>
          }
        </div>
      </div>
    </nav>
    <main class="mx-auto max-w-6xl px-4 py-8">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
