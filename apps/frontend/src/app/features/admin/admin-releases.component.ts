import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ReleaseService } from '../../shared/services/release.service';
import { Release } from '../../shared/models/release.model';

@Component({
  selector: 'app-admin-releases',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1 class="mb-6 text-2xl font-semibold">Admin — Releases</h1>
    @if (loading) {
      <p class="text-slate-600">Cargando…</p>
    } @else if (err) {
      <p class="text-red-600">{{ err }}</p>
    } @else {
      <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b bg-slate-50">
            <tr>
              <th class="px-3 py-2">Equipo</th>
              <th class="px-3 py-2">Estado</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            @for (r of releases; track r.id) {
              <tr class="border-b border-slate-100">
                <td class="px-3 py-2">{{ r.equipo }}</td>
                <td class="px-3 py-2">{{ r.estado }}</td>
                <td class="px-3 py-2">
                  @if (r.estado === 'pending') {
                    <button
                      type="button"
                      class="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      (click)="approve(r)"
                    >
                      Aprobar
                    </button>
                  }
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

  releases: Release[] = [];
  loading = true;
  err = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getAllReleases().subscribe({
      next: (data) => {
        this.releases = data;
        this.loading = false;
      },
      error: () => {
        this.err = 'Error al cargar';
        this.loading = false;
      },
    });
  }

  approve(r: Release): void {
    this.api.approveRelease(r.id).subscribe({
      next: () => this.load(),
      error: () => {
        this.err = 'No se pudo aprobar';
      },
    });
  }
}
