import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ApprovalRule } from '../../shared/models/release.model';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-admin-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-slate-900">
        Reglas de aprobación
      </h1>
      <p class="mt-1 text-sm text-slate-600">
        Tres reglas para releases tipo <span class="font-mono text-xs">rs</span
        >. La regla de cobertura permite ajustar el umbral mínimo.
      </p>
    </div>

    @if (loading) {
      <p class="text-slate-600">Cargando…</p>
    } @else if (err) {
      <div
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        {{ err }}
      </div>
    } @else {
      <div class="space-y-4">
        @for (rule of rules; track rule.id) {
          <div
            class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-slate-900">
                  {{ rule.nombre }}
                </p>
                <p class="mt-1 text-sm text-slate-600">{{ rule.descripcion }}</p>
              </div>
              <label
                class="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  [ngModel]="rule.activa"
                  [ngModelOptions]="{ standalone: true }"
                  [disabled]="savingId === rule.id"
                  (ngModelChange)="toggleActiva(rule, $event)"
                />
                <span>Activa</span>
              </label>
            </div>

            @if (rule.nombre === 'min_coverage') {
              <div
                class="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
              >
                <div>
                  <label
                    [attr.for]="'mincov-' + rule.id"
                    class="mb-1 block text-xs font-medium text-slate-600"
                  >
                    Umbral mínimo de cobertura (%)
                  </label>
                  <input
                    [id]="'mincov-' + rule.id"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    class="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    [ngModel]="minCoverageDraft[rule.id] ?? minCoverageFromRule(rule)"
                    [ngModelOptions]="{ standalone: true }"
                    [disabled]="savingId === rule.id"
                    (ngModelChange)="onMinCoverageInput(rule.id, $event)"
                    (blur)="saveMinCoverage(rule)"
                  />
                </div>
                @if (savingId === rule.id) {
                  <span class="text-xs text-slate-500">Guardando…</span>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class AdminRulesComponent implements OnInit {
  private readonly api = inject(ReleaseService);
  private readonly toastr = inject(ToastrService);

  rules: ApprovalRule[] = [];
  loading = true;
  err = '';
  /** Mientras se persiste toggle o umbral */
  savingId: number | null = null;
  /** Borrador local del input de umbral por id de regla */
  minCoverageDraft: Record<number, number | undefined> = {};

  ngOnInit(): void {
    this.api.getRules().subscribe({
      next: (data) => {
        this.rules = data;
        this.loading = false;
      },
      error: () => {
        this.err = 'Error al cargar reglas';
        this.loading = false;
      },
    });
  }

  minCoverageFromRule(rule: ApprovalRule): number {
    const v = rule.config?.['minCoverage'];
    return typeof v === 'number' && !Number.isNaN(v) ? v : 80;
  }

  onMinCoverageInput(ruleId: number, value: number | string): void {
    const n = typeof value === 'string' ? Number(value) : value;
    this.minCoverageDraft[ruleId] = Number.isNaN(n) ? undefined : n;
  }

  saveMinCoverage(rule: ApprovalRule): void {
    if (rule.nombre !== 'min_coverage') {
      return;
    }
    const raw = this.minCoverageDraft[rule.id];
    const next =
      raw !== undefined ? raw : this.minCoverageFromRule(rule);
    const clamped = Math.min(100, Math.max(0, Math.round(next)));
    if (clamped === this.minCoverageFromRule(rule)) {
      delete this.minCoverageDraft[rule.id];
      return;
    }

    this.savingId = rule.id;
    const config: Record<string, unknown> = {
      ...(rule.config ?? {}),
      minCoverage: clamped,
    };
    this.api.updateRule(rule.id, { config }).subscribe({
      next: (updated) => {
        const i = this.rules.findIndex((r) => r.id === rule.id);
        if (i >= 0) {
          this.rules[i] = updated;
        }
        delete this.minCoverageDraft[rule.id];
        this.savingId = null;
        this.toastr.success('Umbral actualizado');
      },
      error: () => {
        this.savingId = null;
        this.toastr.error('No se pudo guardar el umbral');
      },
    });
  }

  toggleActiva(rule: ApprovalRule, activa: boolean): void {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx < 0) {
      return;
    }
    const prev = this.rules[idx].activa;
    if (prev === activa) {
      return;
    }
    this.rules[idx] = { ...this.rules[idx], activa };
    this.savingId = rule.id;
    this.api.updateRule(rule.id, { activa }).subscribe({
      next: (updated) => {
        this.rules[idx] = updated;
        this.savingId = null;
      },
      error: () => {
        this.rules[idx] = { ...this.rules[idx], activa: prev };
        this.savingId = null;
        this.toastr.error('No se pudo actualizar la regla');
      },
    });
  }
}
