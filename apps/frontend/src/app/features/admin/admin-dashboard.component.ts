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
      <h1 class="text-2xl font-semibold text-slate-900">Administración</h1>
      <p class="mt-1 text-sm text-slate-600">
        Resumen de releases y accesos rápidos al panel de aprobación y reglas.
      </p>
    </div>

    @if (loading) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @for (s of skeleton; track s) {
          <div
            class="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          ></div>
        }
      </div>
    } @else if (err) {
      <div
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        {{ err }}
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {{ stats.total }}
          </p>
        </div>
        <div
          class="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm"
        >
          <p
            class="text-xs font-semibold uppercase tracking-wide text-amber-800/90"
          >
            Pendientes
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-amber-900">
            {{ stats.pending }}
          </p>
        </div>
        <div
          class="rounded-xl border border-blue-200 bg-blue-50/80 p-5 shadow-sm"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-blue-800/90">
            Aprobados automáticos
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-blue-900">
            {{ stats.autoApproved }}
          </p>
        </div>
        <div
          class="rounded-xl border border-slate-200 bg-slate-50/90 p-5 shadow-sm"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Aprobados manuales
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {{ stats.manualApproved }}
          </p>
        </div>
      </div>

      <h2 class="mb-3 mt-10 text-sm font-semibold text-slate-700">
        Acciones rápidas
      </h2>
      <ul class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <li class="min-w-[200px] flex-1">
          <a
            routerLink="/admin/releases"
            class="flex flex-col rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300 hover:bg-slate-50"
          >
            <span class="font-medium text-slate-900">Aprobar pendientes</span>
            <span class="mt-1 text-xs text-slate-500"
              >Lista filtrada con aprobación manual</span
            >
          </a>
        </li>
        <li class="min-w-[200px] flex-1">
          <a
            routerLink="/admin/rules"
            class="flex flex-col rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-300 hover:bg-slate-50"
          >
            <span class="font-medium text-slate-900">Reglas de aprobación</span>
            <span class="mt-1 text-xs text-slate-500"
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
