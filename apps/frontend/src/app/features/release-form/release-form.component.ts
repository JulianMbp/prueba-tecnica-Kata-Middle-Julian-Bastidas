import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import {
  CreateReleaseDto,
  FrameworkItem,
} from '../../shared/models/release.model';
import {
  CoverageFromCiResponse,
  ReleaseService,
} from '../../shared/services/release.service';

/**
 * Acepta URL de PR de GitHub o formato corto owner/repo/número (para reglas del SKILL).
 */
function parseGithubPrInput(raw: string): {
  owner: string;
  repo: string;
  prNumber: string;
} | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const urlRe =
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/)?(?:\?.*)?$/i;
  const um = t.match(urlRe);
  if (um) {
    return { owner: um[1], repo: um[2], prNumber: um[3] };
  }
  const short = t.match(/^([\w.-]+)\/([\w.-]+)\/(\d+)$/);
  if (short) {
    return { owner: short[1], repo: short[2], prNumber: short[3] };
  }
  return null;
}

@Component({
  selector: 'app-release-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="mb-8">
      <h1 class="page-title">Nuevo release</h1>
      <p class="page-subtitle">
        Valida el PR en GitHub y completa los datos de la solicitud.
      </p>
    </div>

    <form
      [formGroup]="form"
      (ngSubmit)="submit()"
      class="app-card max-w-2xl space-y-6 p-6 sm:p-8"
    >
      <div class="flex flex-col gap-1.5">
        <label for="rf-pr" class="app-label">
          Enlace del PR en GitHub <span class="text-red-600">*</span>
        </label>
        <input
          id="rf-pr"
          type="url"
          formControlName="prIdentifier"
          class="app-input font-mono text-sm"
          placeholder="https://github.com/owner/repo/pull/1"
          (blur)="onPrLinkBlur()"
        />
        <p class="text-xs text-slate-500">
          Pega la URL del PR o
          <span class="font-mono">owner/repo/número</span>. Al salir del campo
          validamos el PR y cargamos cobertura y datos.
        </p>
        @if (prUrlError()) {
          <span class="text-xs text-red-600">{{ prUrlError() }}</span>
        }
      </div>

      @if (coverageLoading()) {
        <div
          class="flex items-center gap-3 rounded-xl border border-brand-200/80 bg-brand-50/90 px-4 py-3 text-sm text-brand-900 shadow-soft"
          role="status"
        >
          <span
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"
          ></span>
          Consultando GitHub…
        </div>
      }

      <div class="flex flex-col gap-1.5">
        <span class="app-label">Fecha de la solicitud</span>
        <div
          class="w-full rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-slate-800"
        >
          @if (fechaSolicitud(); as f) {
            {{ f | date: 'longDate' }}
          } @else {
            <span class="text-slate-500">—</span>
          }
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="rf-equipo" class="app-label">Equipo</label>
        <input
          id="rf-equipo"
          type="text"
          formControlName="equipo"
          class="app-input"
          [class.border-red-300]="showErr('equipo')"
        />
        @if (showErr('equipo')) {
          <span class="text-xs text-red-600">El equipo es obligatorio</span>
        }
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="rf-tipo" class="app-label">Tipo</label>
        <select
          id="rf-tipo"
          formControlName="tipo"
          class="app-input"
          [class.border-red-300]="showErr('tipo')"
        >
          <option value="rs">rs (Release)</option>
          <option value="fx">fx (Hot Fix)</option>
          <option value="cv">cv (Ciclo de Vida)</option>
        </select>
        @if (showErr('tipo')) {
          <span class="text-xs text-red-600">Selecciona un tipo</span>
        }
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="rf-desc" class="app-label"
          >Descripción <span class="text-red-600">*</span></label
        >
        <textarea
          id="rf-desc"
          formControlName="descripcion"
          rows="4"
          class="app-input min-h-[7rem] resize-y"
          [class.border-red-300]="showErr('descripcion')"
        ></textarea>
        @if (showErr('descripcion')) {
          <span class="text-xs text-red-600">La descripción es obligatoria</span>
        }
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="rf-cob" class="app-label">Cobertura %</label>
        <div class="flex items-center gap-2">
          @if (coberturaSoloLectura()) {
            <div
              id="rf-cob"
              class="min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-slate-800 tabular-nums"
              [class.border-red-300]="showErr('cobertura')"
              [class.animate-pulse]="coverageLoading()"
            >
              @if (coverageLoading()) {
                <span class="text-slate-500">…</span>
              } @else {
                {{ form.controls.cobertura.value | number: '1.0-1' }}%
              }
            </div>
          } @else {
            <input
              id="rf-cob"
              type="number"
              formControlName="cobertura"
              min="0"
              max="100"
              step="0.1"
              class="app-input min-w-0 flex-1"
              [class.border-red-300]="showErr('cobertura')"
              [attr.placeholder]="
                !prDataReady() ? 'Valida el PR primero' : '0–100'
              "
            />
          }
        </div>
        @if (coverageHint() === 'auto' && autoCoveragePct() != null) {
          <span
            class="inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/80"
          >
            ✓ Cobertura desde GitHub CI ({{
              autoCoveragePct() | number: '1.0-1'
            }}%)
          </span>
        }
        @if (coverageHint() === 'warn' && prDataReady()) {
          <span
            class="inline-flex w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200/80"
          >
            ⚠ No se detectó cobertura en el CI. Indica el % manualmente.
          </span>
        }
        @if (showErr('cobertura')) {
          <span class="text-xs text-red-600">{{
            coberturaErrorMsg()
          }}</span>
        }
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="rf-mail" class="app-label">Email aprobador</label>
        <input
          id="rf-mail"
          type="email"
          formControlName="approverEmail"
          autocomplete="email"
          class="app-input"
          [class.border-red-300]="showErr('approverEmail')"
        />
        @if (showErr('approverEmail')) {
          <span class="text-xs text-red-600">{{
            approverEmailErrorMsg()
          }}</span>
        }
      </div>

      <div class="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span class="text-sm font-semibold text-slate-900">Stack (frameworks)</span>
            <p class="mt-0.5 text-xs text-slate-500">Framework y versión por fila.</p>
          </div>
          <button
            type="button"
            class="btn-secondary py-2 text-xs"
            (click)="addStackRow()"
          >
            + Añadir fila
          </button>
        </div>
        <div formArrayName="stack" class="space-y-3">
          <div
            *ngFor="let _row of stack.controls; let i = index"
            class="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-soft"
            [formGroupName]="i"
          >
            <div class="min-w-[140px] flex-1 flex-col gap-1">
              <label class="text-xs font-medium text-slate-600">Framework</label>
              <input
                type="text"
                formControlName="framework"
                class="app-input py-2 text-sm"
                [class.border-red-300]="stackFieldErr(i, 'framework')"
              />
              @if (stackFieldErr(i, 'framework')) {
                <span class="text-xs text-red-600">Requerido</span>
              }
            </div>
            <div class="min-w-[120px] flex-1 flex-col gap-1">
              <label class="text-xs font-medium text-slate-600">Versión</label>
              <input
                type="text"
                formControlName="version"
                class="app-input py-2 text-sm"
                [class.border-red-300]="stackFieldErr(i, 'version')"
              />
              @if (stackFieldErr(i, 'version')) {
                <span class="text-xs text-red-600">Requerido</span>
              }
            </div>
            @if (stack.length > 1) {
              <button
                type="button"
                class="rounded-lg border border-red-200/90 bg-white px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                (click)="removeStackRow(i)"
              >
                Quitar
              </button>
            }
          </div>
        </div>
        @if (stack.touched && stack.invalid) {
          <p class="mt-2 text-xs text-red-600">
            Completa framework y versión en cada fila del stack.
          </p>
        }
      </div>

      <button
        type="submit"
        class="btn-primary w-full py-3"
        [disabled]="loading() || !canSubmit()"
      >
        @if (loading()) {
          <span
            class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
          ></span>
          <span>Creando…</span>
        } @else {
          Crear release
        }
      </button>
    </form>
  `,
})
export class ReleaseFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ReleaseService);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);

  readonly loading = signal(false);
  readonly coverageLoading = signal(false);
  readonly coverageHint = signal<'none' | 'auto' | 'warn'>('none');
  readonly autoCoveragePct = signal<number | null>(null);
  /** PR resuelto por la API (cobertura + metadatos) */
  readonly prDataReady = signal(false);
  /** Fecha (solo fecha) asignada en el momento en que se valida el PR */
  readonly fechaSolicitud = signal<string | null>(null);
  readonly prUrlError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    equipo: ['', [Validators.required]],
    tipo: ['rs' as 'rs' | 'fx' | 'cv', [Validators.required]],
    descripcion: ['', [Validators.required]],
    prIdentifier: ['', [Validators.required]],
    cobertura: [
      0,
      [Validators.required, Validators.min(0), Validators.max(100)],
    ],
    approverEmail: ['', [Validators.required, Validators.email]],
    stack: this.fb.array([this.createStackGroup()]),
  });

  get stack(): FormArray {
    return this.form.controls.stack;
  }

  private createStackGroup(): FormGroup {
    return this.fb.nonNullable.group({
      framework: ['', Validators.required],
      version: ['', Validators.required],
    });
  }

  addStackRow(): void {
    this.stack.push(this.createStackGroup());
  }

  removeStackRow(index: number): void {
    if (this.stack.length <= 1) {
      return;
    }
    this.stack.removeAt(index);
  }

  canSubmit(): boolean {
    if (!this.prDataReady() || !this.fechaSolicitud()) {
      return false;
    }
    return this.form.valid;
  }

  showErr(
    name: 'equipo' | 'tipo' | 'descripcion' | 'cobertura' | 'approverEmail',
  ): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  coberturaErrorMsg(): string {
    const c = this.form.controls.cobertura;
    if (c.hasError('required')) {
      return 'La cobertura es obligatoria';
    }
    if (c.hasError('min') || c.hasError('max')) {
      return 'Debe estar entre 0 y 100';
    }
    return '';
  }

  approverEmailErrorMsg(): string {
    const c = this.form.controls.approverEmail;
    if (c.hasError('required')) {
      return 'El email es obligatorio';
    }
    if (c.hasError('email')) {
      return 'Introduce un email válido';
    }
    return '';
  }

  stackFieldErr(index: number, field: 'framework' | 'version'): boolean {
    const g = this.stack.at(index)?.get(field);
    return !!g && g.invalid && (g.touched || g.dirty || this.stack.touched);
  }

  coberturaSoloLectura(): boolean {
    return (
      this.coverageLoading() ||
      (this.coverageHint() === 'auto' && this.prDataReady())
    );
  }

  private resetPrFlow(): void {
    this.prDataReady.set(false);
    this.fechaSolicitud.set(null);
    this.coverageHint.set('none');
    this.autoCoveragePct.set(null);
    this.coverageLoading.set(false);
    const cob = this.form.controls.cobertura;
    cob.enable({ emitEvent: false });
    cob.setValue(0, { emitEvent: false });
  }

  onPrLinkBlur(): void {
    this.prUrlError.set(null);
    const raw = this.form.controls.prIdentifier.value?.trim() ?? '';

    if (!raw) {
      this.resetPrFlow();
      return;
    }

    const parsed = parseGithubPrInput(raw);
    if (!parsed) {
      this.prUrlError.set(
        'Formato inválido. Usa la URL del PR en GitHub o owner/repo/número.',
      );
      this.resetPrFlow();
      return;
    }

    const { owner, repo, prNumber } = parsed;
    const canonical = `${owner}/${repo}/${prNumber}`;
    this.form.controls.prIdentifier.setValue(canonical, { emitEvent: false });

    const cob = this.form.controls.cobertura;
    cob.disable({ emitEvent: false });
    this.coverageLoading.set(true);
    this.coverageHint.set('none');
    this.autoCoveragePct.set(null);
    this.prDataReady.set(false);
    this.fechaSolicitud.set(null);

    this.api
      .getCoverage(owner, repo, prNumber)
      .pipe(finalize(() => this.coverageLoading.set(false)))
      .subscribe({
        next: (res: CoverageFromCiResponse) => {
          if (!res.pr) {
            this.resetPrFlow();
            if (res.detail === 'pr_not_found') {
              this.toastr.error('No se encontró ese PR en GitHub.', 'PR');
            } else if (res.detail === 'unauthorized_or_forbidden') {
              this.toastr.error(
                'Sin acceso al repositorio (revisa GITHUB_TOKEN).',
                'GitHub',
              );
            } else {
              this.toastr.error('No se pudo cargar el PR.', 'Error');
            }
            return;
          }

          this.prDataReady.set(true);
          this.fechaSolicitud.set(new Date().toISOString().slice(0, 10));

          const desc = (res.pr.body ?? '').trim();
          this.form.patchValue({
            descripcion: desc,
          });

          if (res.found && res.coverage != null) {
            cob.setValue(res.coverage, { emitEvent: false });
            cob.disable({ emitEvent: false });
            this.autoCoveragePct.set(res.coverage);
            this.coverageHint.set('auto');
          } else {
            cob.enable({ emitEvent: false });
            cob.setValue(0, { emitEvent: false });
            this.coverageHint.set('warn');
          }
        },
        error: () => {
          this.resetPrFlow();
          this.toastr.error(
            'No se pudo contactar con el servicio de integración.',
            'Error',
          );
        },
      });
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      this.stack.controls.forEach((ctrl) => ctrl.markAllAsTouched());
      if (!this.prDataReady()) {
        this.toastr.warning('Primero valida el PR de GitHub.', 'Formulario');
      }
      return;
    }

    const v = this.form.getRawValue();
    const fecha = this.fechaSolicitud();
    if (!fecha) {
      return;
    }

    const dto: CreateReleaseDto = {
      fecha,
      equipo: v.equipo,
      tipo: v.tipo,
      descripcion: v.descripcion,
      prIdentifier: v.prIdentifier.trim(),
      cobertura: Number(v.cobertura),
      stack: v.stack as FrameworkItem[],
      approverEmail: v.approverEmail,
    };

    this.loading.set(true);
    this.api
      .createRelease(dto)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (release) => {
          const estado = release.estado ?? '—';
          const auto = release.aprobacionAutomatica ? ' (automática)' : '';
          this.toastr.success(
            `Estado del release: ${estado}${auto}`,
            'Release creado',
          );
          void this.router.navigateByUrl('/releases');
        },
        error: (err: { error?: { message?: string } }) => {
          const msg =
            err?.error?.message ??
            'No se pudo crear el release. Revisa los datos.';
          this.toastr.error(msg, 'Error');
        },
      });
  }
}
