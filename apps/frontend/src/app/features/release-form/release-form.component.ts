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
import { ReleaseService } from '../../shared/services/release.service';

@Component({
  selector: 'app-release-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h1 class="mb-6 text-2xl font-semibold text-slate-900">Nuevo release</h1>

    <form
      [formGroup]="form"
      (ngSubmit)="submit()"
      class="max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div class="flex flex-col gap-1">
        <label for="rf-fecha" class="text-sm font-medium text-slate-700"
          >Fecha</label
        >
        <input
          id="rf-fecha"
          type="date"
          formControlName="fecha"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          [class.border-red-400]="showErr('fecha')"
        />
        @if (showErr('fecha')) {
          <span class="text-xs text-red-600">La fecha es obligatoria</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="rf-equipo" class="text-sm font-medium text-slate-700"
          >Equipo</label
        >
        <input
          id="rf-equipo"
          type="text"
          formControlName="equipo"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          [class.border-red-400]="showErr('equipo')"
        />
        @if (showErr('equipo')) {
          <span class="text-xs text-red-600">El equipo es obligatorio</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="rf-tipo" class="text-sm font-medium text-slate-700"
          >Tipo</label
        >
        <select
          id="rf-tipo"
          formControlName="tipo"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          [class.border-red-400]="showErr('tipo')"
        >
          <option value="rs">rs (Release)</option>
          <option value="fx">fx (Hot Fix)</option>
          <option value="cv">cv (Ciclo de Vida)</option>
        </select>
        @if (showErr('tipo')) {
          <span class="text-xs text-red-600">Selecciona un tipo</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="rf-desc" class="text-sm font-medium text-slate-700"
          >Descripción</label
        >
        <textarea
          id="rf-desc"
          formControlName="descripcion"
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          [class.border-red-400]="showErr('descripcion')"
        ></textarea>
        @if (showErr('descripcion')) {
          <span class="text-xs text-red-600">La descripción es obligatoria</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="rf-pr" class="text-sm font-medium text-slate-700"
          >PR / JIRA <span class="font-normal text-slate-500">(opcional)</span></label
        >
        <input
          id="rf-pr"
          type="text"
          formControlName="prIdentifier"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label for="rf-cob" class="text-sm font-medium text-slate-700"
          >Cobertura %</label
        >
        <input
          id="rf-cob"
          type="number"
          formControlName="cobertura"
          min="0"
          max="100"
          step="0.1"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          [class.border-red-400]="showErr('cobertura')"
        />
        @if (showErr('cobertura')) {
          <span class="text-xs text-red-600">{{
            coberturaErrorMsg()
          }}</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <label for="rf-mail" class="text-sm font-medium text-slate-700"
          >Email aprobador</label
        >
        <input
          id="rf-mail"
          type="email"
          formControlName="approverEmail"
          autocomplete="email"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          [class.border-red-400]="showErr('approverEmail')"
        />
        @if (showErr('approverEmail')) {
          <span class="text-xs text-red-600">{{
            approverEmailErrorMsg()
          }}</span>
        }
      </div>

      <div class="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-800">Stack (frameworks)</span>
          <button
            type="button"
            class="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300"
            (click)="addStackRow()"
          >
            + Añadir fila
          </button>
        </div>
        <div formArrayName="stack" class="space-y-3">
          <div
            *ngFor="let _row of stack.controls; let i = index"
            class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
            [formGroupName]="i"
          >
              <div class="min-w-[140px] flex-1 flex-col gap-1">
                <label class="text-xs text-slate-600">Framework</label>
                <input
                  type="text"
                  formControlName="framework"
                  class="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  [class.border-red-400]="stackFieldErr(i, 'framework')"
                />
                @if (stackFieldErr(i, 'framework')) {
                  <span class="text-xs text-red-600">Requerido</span>
                }
              </div>
              <div class="min-w-[120px] flex-1 flex-col gap-1">
                <label class="text-xs text-slate-600">Versión</label>
                <input
                  type="text"
                  formControlName="version"
                  class="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  [class.border-red-400]="stackFieldErr(i, 'version')"
                />
                @if (stackFieldErr(i, 'version')) {
                  <span class="text-xs text-red-600">Requerido</span>
                }
              </div>
              @if (stack.length > 1) {
                <button
                  type="button"
                  class="rounded border border-red-200 px-2 py-2 text-xs text-red-700 hover:bg-red-50"
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
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        [disabled]="loading()"
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

  readonly form = this.fb.nonNullable.group({
    fecha: [this.defaultFecha(), [Validators.required]],
    equipo: ['', [Validators.required]],
    tipo: ['rs' as 'rs' | 'fx' | 'cv', [Validators.required]],
    descripcion: ['', [Validators.required]],
    prIdentifier: [''],
    cobertura: [
      80,
      [Validators.required, Validators.min(0), Validators.max(100)],
    ],
    approverEmail: ['', [Validators.required, Validators.email]],
    stack: this.fb.array([this.createStackGroup()]),
  });

  get stack(): FormArray {
    return this.form.controls.stack;
  }

  private defaultFecha(): string {
    return new Date().toISOString().slice(0, 10);
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

  showErr(
    name:
      | 'fecha'
      | 'equipo'
      | 'tipo'
      | 'descripcion'
      | 'cobertura'
      | 'approverEmail',
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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.stack.controls.forEach((ctrl) => ctrl.markAllAsTouched());
      return;
    }

    const v = this.form.getRawValue();
    const pr = v.prIdentifier?.trim();
    const dto: CreateReleaseDto = {
      fecha: v.fecha,
      equipo: v.equipo,
      tipo: v.tipo,
      descripcion: v.descripcion,
      prIdentifier: pr ? pr : undefined,
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
