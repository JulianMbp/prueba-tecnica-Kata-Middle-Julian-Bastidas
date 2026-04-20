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
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-slate-900">
        Releases pendientes
      </h1>
      <p class="mt-1 text-sm text-slate-600">
        Aprobación manual. Los cambios se reflejan al instante; si falla el
        servidor se revierte la fila.
      </p>
    </div>

    @if (loading) {
      <p class="text-slate-600">Cargando…</p>
    } @else if (errLoad) {
      <div
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        {{ errLoad }}
      </div>
    } @else if (pending.length === 0) {
      <div
        class="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center"
      >
        <p class="font-medium text-slate-700">No hay releases pendientes</p>
        <p class="mt-1 text-sm text-slate-500">
          Cuando una evaluación automática falle, aparecerán aquí para
          revisión.
        </p>
      </div>
    } @else {
      <div
        class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead
            class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
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
                <td class="max-w-xs truncate px-4 py-3 text-slate-700" [title]="r.descripcion">
                  {{ r.descripcion }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                  {{ r.cobertura | number: '1.0-1' }}%
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
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
}
