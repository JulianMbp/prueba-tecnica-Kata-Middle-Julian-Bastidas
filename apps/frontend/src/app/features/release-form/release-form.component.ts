import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreateReleaseDto } from '../../shared/models/release.model';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-release-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1 class="mb-6 text-2xl font-semibold">Nuevo release</h1>
    @if (error) {
      <p class="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>
    }
    <form
      (ngSubmit)="submit()"
      class="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow"
    >
      <label class="block text-sm">
        <span class="mb-1 block">Fecha</span>
        <input
          type="date"
          [(ngModel)]="fecha"
          name="fecha"
          required
          class="w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">Equipo</span>
        <input
          [(ngModel)]="equipo"
          name="equipo"
          required
          class="w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">Tipo</span>
        <select
          [(ngModel)]="tipo"
          name="tipo"
          required
          class="w-full rounded border border-slate-300 px-3 py-2"
        >
          <option value="rs">rs (Release)</option>
          <option value="fx">fx (Hot Fix)</option>
          <option value="cv">cv (Ciclo de Vida)</option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">Descripción</span>
        <textarea
          [(ngModel)]="descripcion"
          name="descripcion"
          required
          rows="3"
          class="w-full rounded border border-slate-300 px-3 py-2"
        ></textarea>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">PR / JIRA (opcional)</span>
        <input
          [(ngModel)]="prIdentifier"
          name="prIdentifier"
          class="w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">Cobertura %</span>
        <input
          type="number"
          [(ngModel)]="cobertura"
          name="cobertura"
          min="0"
          max="100"
          required
          class="w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">Stack (JSON)</span>
        <textarea
          [(ngModel)]="stackJson"
          name="stack"
          rows="4"
          class="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
        ></textarea>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block">Email aprobador</span>
        <input
          type="email"
          [(ngModel)]="approverEmail"
          name="approverEmail"
          required
          class="w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        class="rounded bg-slate-800 px-4 py-2 text-white hover:bg-slate-900"
      >
        Crear
      </button>
    </form>
  `,
})
export class ReleaseFormComponent {
  private readonly api = inject(ReleaseService);
  private readonly router = inject(Router);

  fecha = new Date().toISOString().slice(0, 10);
  equipo = '';
  tipo: 'rs' | 'fx' | 'cv' = 'rs';
  descripcion = '';
  prIdentifier = '';
  cobertura = 80;
  approverEmail = '';
  stackJson = '[{"framework":"react","version":"18.2.0"}]';
  error = '';

  submit(): void {
    this.error = '';
    let stack: CreateReleaseDto['stack'];
    try {
      stack = JSON.parse(this.stackJson) as CreateReleaseDto['stack'];
    } catch {
      this.error = 'Stack JSON inválido';
      return;
    }
    const dto: CreateReleaseDto = {
      fecha: this.fecha,
      equipo: this.equipo,
      tipo: this.tipo,
      descripcion: this.descripcion,
      prIdentifier: this.prIdentifier || undefined,
      cobertura: Number(this.cobertura),
      stack,
      approverEmail: this.approverEmail,
    };
    this.api.createRelease(dto).subscribe({
      next: () => void this.router.navigateByUrl('/releases'),
      error: (e) => {
        this.error =
          e?.error?.message ?? 'Error al crear el release';
      },
    });
  }
}
