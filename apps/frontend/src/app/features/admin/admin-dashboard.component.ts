import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Release } from '../../shared/models/release.model';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mb-8">
      <h1 class="page-title">Administración</h1>
      <p class="page-subtitle">
        Resumen de releases y accesos rápidos al panel de aprobación y reglas.
      </p>
    </div>

    @if (loading) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (s of skeleton; track s) {
          <div
            class="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80"
          ></div>
        }
      </div>
    } @else if (err) {
      <div
        class="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-soft"
        role="alert"
      >
        {{ err }}
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          class="app-card relative overflow-hidden border-slate-200/80 p-5 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-brand-500"
        >
          <svg
            class="mb-3 h-8 w-8 text-brand-500/90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 6h16M4 10h16M4 14h10"
            />
          </svg>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {{ stats.total }}
          </p>
        </div>
        <div
          class="app-card relative overflow-hidden border-amber-200/60 bg-amber-50/50 p-5 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-amber-500"
        >
          <svg
            class="mb-3 h-8 w-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p
            class="text-xs font-semibold uppercase tracking-wider text-amber-800/90"
          >
            Pendientes
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums tracking-tight text-amber-950">
            {{ stats.pending }}
          </p>
        </div>
        <div
          class="app-card relative overflow-hidden border-brand-200/60 bg-brand-50/40 p-5 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-brand-600"
        >
          <svg
            class="mb-3 h-8 w-8 text-brand-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p
            class="text-xs font-semibold uppercase tracking-wider text-brand-800/90"
          >
            Aprobados automáticos
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums tracking-tight text-brand-950">
            {{ stats.autoApproved }}
          </p>
        </div>
        <div
          class="app-card relative overflow-hidden border-slate-200/80 bg-slate-50/50 p-5 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-slate-400"
        >
          <svg
            class="mb-3 h-8 w-8 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Aprobados manuales
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {{ stats.manualApproved }}
          </p>
        </div>
      </div>

      <h2 class="mb-4 mt-12 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Acciones rápidas
      </h2>
      <ul class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <li class="min-w-[220px] flex-1">
          <a
            routerLink="/admin/releases"
            class="app-card group flex flex-col gap-1 p-5 transition hover:border-brand-300/80 hover:shadow-card"
          >
            <span class="font-semibold text-slate-900 group-hover:text-brand-800"
              >Aprobar pendientes</span
            >
            <span class="text-xs text-slate-500"
              >Lista filtrada con aprobación manual</span
            >
          </a>
        </li>
        <li class="min-w-[220px] flex-1">
          <a
            routerLink="/admin/rules"
            class="app-card group flex flex-col gap-1 p-5 transition hover:border-brand-300/80 hover:shadow-card"
          >
            <span class="font-semibold text-slate-900 group-hover:text-brand-800"
              >Reglas de aprobación</span
            >
            <span class="text-xs text-slate-500"
              >Activar reglas y umbral de cobertura</span
            >
          </a>
        </li>
      </ul>
    }
  `,
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(ReleaseService);

  readonly skeleton = [1, 2, 3, 4];

  loading = true;
  err = '';

  stats = {
    total: 0,
    pending: 0,
    autoApproved: 0,
    manualApproved: 0,
  };

  ngOnInit(): void {
    this.api.getAllReleases().subscribe({
      next: (releases) => {
        this.stats = this.computeStats(releases);
        this.loading = false;
      },
      error: () => {
        this.err = 'No se pudieron cargar los datos del panel.';
        this.loading = false;
      },
    });
  }

  private computeStats(releases: Release[]): typeof this.stats {
    let pending = 0;
    let autoApproved = 0;
    let manualApproved = 0;
    for (const r of releases) {
      if (r.estado === 'pending') {
        pending += 1;
      } else if (r.estado === 'approved') {
        if (r.aprobacionAutomatica) {
          autoApproved += 1;
        } else {
          manualApproved += 1;
        }
      }
    }
    return {
      total: releases.length,
      pending,
      autoApproved,
      manualApproved,
    };
  }
}
