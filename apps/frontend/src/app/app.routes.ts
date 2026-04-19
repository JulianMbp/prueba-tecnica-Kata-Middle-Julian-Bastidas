import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'releases' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'releases',
    loadComponent: () =>
      import('./features/release-list/release-list.component').then(
        (m) => m.ReleaseListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'releases/new',
    loadComponent: () =>
      import('./features/release-form/release-form.component').then(
        (m) => m.ReleaseFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin/dashboard',
    loadComponent: () =>
      import('./features/admin/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'admin/releases',
    loadComponent: () =>
      import('./features/admin/admin-releases.component').then(
        (m) => m.AdminReleasesComponent,
      ),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'admin/rules',
    loadComponent: () =>
      import('./features/admin/admin-rules.component').then(
        (m) => m.AdminRulesComponent,
      ),
    canActivate: [authGuard, adminGuard],
  },
  { path: '**', redirectTo: 'releases' },
];
