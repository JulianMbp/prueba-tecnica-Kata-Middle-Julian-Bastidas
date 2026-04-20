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
    <div class="mb-8">
      <h1 class="page-title">Reglas de aprobación</h1>
      <p class="page-subtitle">
        Tres reglas para releases tipo <span class="font-mono text-xs text-slate-700"
          >rs</span
        >. La regla de cobertura permite ajustar el umbral mínimo.
      </p>
    </div>

    @if (loading) {
      <div class="space-y-4" role="status" aria-label="Cargando reglas">
        @for (s of skeletonRows; track s) {
          <div
            class="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80"
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
      <div class="space-y-4">
        @for (rule of rules; track rule.id) {
          <div class="app-card p-5 sm:p-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-brand-900">
                  {{ rule.nombre }}
                </p>
                <p class="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {{ rule.descripcion }}
                </p>
              </div>
              <label
                class="flex shrink-0 cursor-pointer select-none items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-100/80"
              >
                <input
                  type="checkbox"
                  class="h-5 w-5 rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 focus:ring-offset-0"
                  [ngModel]="rule.activa"
                  [ngModelOptions]="{ standalone: true }"
                  [disabled]="savingId === rule.id"
                  (ngModelChange)="toggleActiva(rule, $event)"
                />
                <span class="font-medium">Activa</span>
              </label>
            </div>

            @if (rule.nombre === 'min_coverage') {
              <div
                class="mt-5 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-5"
              >
                <div>
                  <label
                    [attr.for]="'mincov-' + rule.id"
                    class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Umbral mínimo de cobertura (%)
                  </label>
                  <input
                    [id]="'mincov-' + rule.id"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    class="app-input w-32 tabular-nums"
                    [ngModel]="minCoverageDraft[rule.id] ?? minCoverageFromRule(rule)"
                    [ngModelOptions]="{ standalone: true }"
                    [disabled]="savingId === rule.id"
                    (ngModelChange)="onMinCoverageInput(rule.id, $event)"
                    (blur)="saveMinCoverage(rule)"
                  />
                </div>
                @if (savingId === rule.id) {
                  <span
                    class="inline-flex items-center gap-2 text-xs font-medium text-slate-500"
                  >
                    <span
                      class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
                    ></span>
                    Guardando…
                  </span>
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

  readonly skeletonRows = [1, 2, 3];

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
