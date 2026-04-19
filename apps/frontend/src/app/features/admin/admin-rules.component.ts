import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApprovalRule } from '../../shared/models/release.model';
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-admin-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h1 class="mb-6 text-2xl font-semibold">Admin — Reglas</h1>
    @if (loading) {
      <p class="text-slate-600">Cargando…</p>
    } @else if (err) {
      <p class="text-red-600">{{ err }}</p>
    } @else {
      <div class="space-y-4">
        @for (rule of rules; track rule.id) {
          <div
            class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="font-medium">{{ rule.nombre }}</p>
                <p class="text-sm text-slate-600">{{ rule.descripcion }}</p>
              </div>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  [ngModel]="rule.activa"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="toggleActiva(rule, $event)"
                />
                Activa
              </label>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class AdminRulesComponent implements OnInit {
  private readonly api = inject(ReleaseService);

  rules: ApprovalRule[] = [];
  loading = true;
  err = '';

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

  toggleActiva(rule: ApprovalRule, activa: boolean): void {
    this.api.updateRule(rule.id, { activa }).subscribe({
      next: (updated) => {
        const i = this.rules.findIndex((r) => r.id === rule.id);
        if (i >= 0) {
          this.rules[i] = updated;
        }
      },
      error: () => {
        this.err = 'No se pudo actualizar';
      },
    });
  }
}
