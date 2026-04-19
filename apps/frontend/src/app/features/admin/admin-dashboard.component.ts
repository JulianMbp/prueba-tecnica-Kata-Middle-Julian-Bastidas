import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1 class="mb-6 text-2xl font-semibold">Administración</h1>
    <ul class="flex flex-col gap-3 text-slate-800">
      <li>
        <a
          routerLink="/admin/releases"
          class="block rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm hover:bg-slate-50"
          >Releases (aprobar manualmente)</a
        >
      </li>
      <li>
        <a
          routerLink="/admin/rules"
          class="block rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm hover:bg-slate-50"
          >Reglas de aprobación</a
        >
      </li>
    </ul>
  `,
})
export class AdminDashboardComponent {}
