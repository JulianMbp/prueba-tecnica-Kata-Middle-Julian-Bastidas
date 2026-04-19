import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Release } from '../../shared/models/release.model';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-release-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold text-slate-900">Releases</h1>
      <a
        routerLink="/releases/new"
        class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Nueva Solicitud
      </a>
    </div>

    @if (loading) {
      <div
        class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        role="status"
        aria-label="Cargando releases"
      >
        <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div class="h-4 w-40 animate-pulse rounded bg-slate-200"></div>
        </div>
        <div class="divide-y divide-slate-100 p-4">
          @for (s of skeletonRows; track s) {
            <div class="flex flex-wrap items-center gap-4 py-4">
              <div
                class="h-4 w-24 animate-pulse rounded bg-slate-200"
              ></div>
              <div
                class="h-4 w-28 animate-pulse rounded bg-slate-200"
              ></div>
              <div
                class="h-6 w-16 animate-pulse rounded-full bg-slate-200"
              ></div>
              <div
                class="h-6 w-24 animate-pulse rounded-full bg-slate-200"
              ></div>
              <div
                class="h-6 w-20 animate-pulse rounded-full bg-slate-200"
              ></div>
              <div
                class="h-3 min-w-[100px] flex-1 animate-pulse rounded-full bg-slate-200"
              ></div>
            </div>
          }
        </div>
      </div>
    } @else if (err) {
      <div
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        {{ err }}
      </div>
    } @else if (releases.length === 0) {
      <div
        class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-16 text-center"
      >
        <svg
          class="mb-4 h-12 w-12 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4"
          />
        </svg>
        <p class="text-lg font-medium text-slate-700">No hay releases</p>
        <p class="mt-1 max-w-sm text-sm text-slate-500">
          Aún no se registró ninguna solicitud. Crea la primera desde el botón
          de abajo.
        </p>
        <a
          routerLink="/releases/new"
          class="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Nueva Solicitud
        </a>
      </div>
    } @else {
      <div
        class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Fecha</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Equipo</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Tipo</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Estado</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">
                Aprobación
              </th>
              <th scope="col" class="min-w-[140px] px-4 py-3">Cobertura</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (r of releases; track r.id) {
              <tr class="hover:bg-slate-50/80">
                <td class="whitespace-nowrap px-4 py-3 text-slate-800">
                  {{ formatFecha(r.fecha) }}
                </td>
                <td class="px-4 py-3 font-medium text-slate-900">
                  {{ r.equipo }}
                </td>
                <td class="px-4 py-3">
                  <span [class]="tipoBadgeClass(r.tipo)">{{ r.tipo }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-2">
                    <span
                      class="inline-flex shrink-0 text-slate-600"
                      [attr.aria-label]="'Estado ' + r.estado"
                    >
                      @switch (r.estado) {
                        @case ('approved') {
                          <svg
                            class="h-5 w-5 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        }
                        @case ('pending') {
                          <svg
                            class="h-5 w-5 text-amber-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        }
                        @case ('rejected') {
                          <svg
                            class="h-5 w-5 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M15 9l-6 6M9 9l6 6"
                            />
                          </svg>
                        }
                        @default {
                          <svg
                            class="h-5 w-5 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        }
                      }
                    </span>
                    <span [class]="estadoBadgeClass(r.estado)">{{
                      r.estado
                    }}</span>
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span [class]="aprobacionBadgeClass(r.aprobacionAutomatica)">{{
                    r.aprobacionAutomatica ? 'Automática' : 'Manual'
                  }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex min-w-[130px] items-center gap-2">
                    <div
                      class="h-2.5 min-w-[72px] flex-1 overflow-hidden rounded-full bg-slate-200"
                      [attr.aria-valuenow]="r.cobertura"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      role="progressbar"
                      [attr.aria-label]="
                        'Cobertura ' + (r.cobertura | number: '1.0-1') + '%'
                      "
                    >
                      <div
                        class="h-full rounded-full bg-emerald-500 transition-all"
                        [style.width.%]="clampCobertura(r.cobertura)"
                      ></div>
                    </div>
                    <span
                      class="w-12 shrink-0 text-right text-xs tabular-nums text-slate-600"
                      >{{ r.cobertura | number: '1.0-1' }}%</span
                    >
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class ReleaseListComponent implements OnInit {
  private readonly releasesApi = inject(ReleaseService);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  releases: Release[] = [];
  loading = true;
  err = '';

  ngOnInit(): void {
    this.releasesApi.getAllReleases().subscribe({
      next: (data) => {
        this.releases = data;
        this.loading = false;
      },
      error: () => {
        this.err = 'No se pudieron cargar los releases';
        this.loading = false;
      },
    });
  }

  formatFecha(fecha: string): string {
    if (!fecha) {
      return '—';
    }
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) {
      return fecha.slice(0, 10);
    }
    return d.toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  clampCobertura(n: number): number {
    return Math.min(100, Math.max(0, n ?? 0));
  }

  /** SKILL — badges Tailwind */
  estadoBadgeClass(estado: string): string {
    const base = 'inline-flex rounded px-2 py-0.5 text-xs font-medium ';
    if (estado === 'approved') {
      return base + 'bg-green-100 text-green-800';
    }
    if (estado === 'pending') {
      return base + 'bg-yellow-100 text-yellow-800';
    }
    if (estado === 'rejected') {
      return base + 'bg-red-100 text-red-800';
    }
    return base + 'bg-slate-100 text-slate-800';
  }

  tipoBadgeClass(tipo: string): string {
    const base = 'inline-flex rounded px-2 py-0.5 text-xs font-medium ';
    if (tipo === 'rs') {
      return base + 'bg-blue-100 text-blue-800';
    }
    if (tipo === 'fx') {
      return base + 'bg-orange-100 text-orange-800';
    }
    if (tipo === 'cv') {
      return base + 'bg-purple-100 text-purple-800';
    }
    return base + 'bg-slate-100 text-slate-800';
  }

  aprobacionBadgeClass(auto: boolean): string {
    const base = 'inline-flex rounded px-2 py-0.5 text-xs font-medium ';
    return (
      base +
      (auto ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')
    );
  }
}
