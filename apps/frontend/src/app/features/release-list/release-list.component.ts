import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReleaseService } from '../../shared/services/release.service';
import { Release } from '../../shared/models/release.model';

@Component({
  selector: 'app-release-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">Releases</h1>
      <a
        routerLink="/releases/new"
        class="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900"
        >Nuevo release</a
      >
    </div>
    @if (loading) {
      <p class="mt-6 text-slate-600">Cargando…</p>
    } @else if (err) {
      <p class="mt-6 text-red-600">{{ err }}</p>
    } @else {
      <div class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-200 bg-slate-50">
            <tr>
              <th class="px-3 py-2">Equipo</th>
              <th class="px-3 py-2">Tipo</th>
              <th class="px-3 py-2">Estado</th>
              <th class="px-3 py-2">Auto</th>
              <th class="px-3 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            @for (r of releases; track r.id) {
              <tr class="border-b border-slate-100">
                <td class="px-3 py-2">{{ r.equipo }}</td>
                <td class="px-3 py-2">
                  <span [class]="tipoClass(r.tipo)">{{ r.tipo }}</span>
                </td>
                <td class="px-3 py-2">
                  <span [class]="estadoClass(r.estado)">{{ r.estado }}</span>
                </td>
                <td class="px-3 py-2">
                  <span [class]="autoClass(r.aprobacionAutomatica)">{{
                    r.aprobacionAutomatica ? 'Automática' : 'Manual'
                  }}</span>
                </td>
                <td class="px-3 py-2 text-slate-600">{{ r.fecha | slice : 0 : 10 }}</td>
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

  estadoClass(estado: string): string {
    const base = 'rounded px-2 py-0.5 text-xs font-medium ';
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

  tipoClass(tipo: string): string {
    const base = 'rounded px-2 py-0.5 text-xs font-medium ';
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

  autoClass(auto: boolean): string {
    const base = 'rounded px-2 py-0.5 text-xs font-medium ';
    return (
      base +
      (auto ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')
    );
  }
}
