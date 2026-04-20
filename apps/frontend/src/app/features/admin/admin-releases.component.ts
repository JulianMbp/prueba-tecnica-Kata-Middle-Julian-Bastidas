import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Release } from '../../shared/models/release.model';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-admin-releases',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-8">
      <h1 class="page-title">Releases pendientes</h1>
      <p class="page-subtitle">
        Aprobación manual. Los cambios se reflejan al instante; si falla el
        servidor se revierte la fila.
      </p>
    </div>

    @if (loading) {
      <div
        class="table-shell overflow-hidden"
        role="status"
        aria-label="Cargando releases pendientes"
      >
        <div class="border-b border-slate-100/90 bg-slate-50/90 px-4 py-3">
          <div class="h-4 w-48 animate-pulse rounded-lg bg-slate-200/90"></div>
        </div>
        <div class="divide-y divide-slate-100 p-4">
          @for (s of skeletonRows; track s) {
            <div class="flex flex-wrap items-center gap-4 py-4">
              <div class="h-4 w-24 animate-pulse rounded bg-slate-200"></div>
              <div class="h-4 w-28 animate-pulse rounded bg-slate-200"></div>
              <div class="h-6 w-14 animate-pulse rounded-full bg-slate-200"></div>
              <div
                class="h-4 min-w-[120px] flex-1 animate-pulse rounded bg-slate-200"
              ></div>
              <div class="h-8 w-20 animate-pulse rounded-lg bg-slate-200"></div>
            </div>
          }
        </div>
      </div>
    } @else if (errLoad) {
      <div
        class="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-soft"
        role="alert"
      >
        {{ errLoad }}
      </div>
    } @else if (pending.length === 0) {
      <div
        class="rounded-2xl border border-dashed border-slate-300/90 bg-white/60 px-6 py-14 text-center shadow-soft"
      >
        <p class="font-semibold text-slate-800">No hay releases pendientes</p>
        <p class="mt-2 text-sm text-slate-500">
          Cuando una evaluación automática falle, aparecerán aquí para
          revisión.
        </p>
      </div>
    } @else {
      <div class="table-shell overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead class="table-header divide-y divide-slate-100">
            <tr>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Fecha</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Equipo</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Tipo</th>
              <th scope="col" class="min-w-[180px] px-4 py-3">Descripción</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3">Cobertura</th>
              <th scope="col" class="whitespace-nowrap px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (r of pending; track r.id) {
              <tr class="transition hover:bg-brand-50/40">
                <td class="whitespace-nowrap px-4 py-3 text-slate-800">
                  {{ formatFecha(r.fecha) }}
                </td>
                <td class="px-4 py-3 font-medium text-slate-900">
                  {{ r.equipo }}
                </td>
                <td class="px-4 py-3">
                  <span [class]="tipoBadgeClass(r.tipo)">{{ r.tipo }}</span>
                </td>
                <td
                  class="max-w-xs truncate px-4 py-3 text-slate-700"
                  [title]="r.descripcion"
                >
                  {{ r.descripcion }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                  {{ r.cobertura | number: '1.0-1' }}%
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    (click)="approve(r)"
                  >
                    Aprobar
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminReleasesComponent implements OnInit {
  private readonly api = inject(ReleaseService);
  private readonly toastr = inject(ToastrService);

  readonly skeletonRows = [1, 2, 3, 4, 5];

  /** Solo estado <code>pending</code> */
  pending: Release[] = [];
  loading = true;
  errLoad = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errLoad = '';
    this.api.getAllReleases().subscribe({
      next: (data) => {
        this.pending = data.filter((r) => r.estado === 'pending');
        this.loading = false;
      },
      error: () => {
        this.errLoad = 'Error al cargar releases';
        this.loading = false;
      },
    });
  }

  approve(r: Release): void {
    const snapshot = [...this.pending];
    this.pending = this.pending.filter((x) => x.id !== r.id);

    this.api.approveRelease(r.id).subscribe({
      next: () => {
        this.toastr.success('Release aprobado', 'Listo');
      },
      error: () => {
        this.pending = snapshot;
        this.toastr.error(
          'No se pudo aprobar. Inténtalo de nuevo.',
          'Error',
        );
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

  tipoBadgeClass(tipo: string): string {
    const base =
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ';
    if (tipo === 'rs') {
      return base + 'bg-brand-50 text-brand-900 ring-brand-200/80';
    }
    if (tipo === 'fx') {
      return base + 'bg-orange-50 text-orange-900 ring-orange-200/80';
    }
    if (tipo === 'cv') {
      return base + 'bg-violet-50 text-violet-900 ring-violet-200/80';
    }
    return base + 'bg-slate-100 text-slate-800 ring-slate-200/80';
  }
}
