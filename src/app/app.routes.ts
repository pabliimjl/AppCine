import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./componentes/cartelera/cartelera').then(m => m.Cartelera),
    title: 'Bienvenido - Cartelera' 
  }, 
  { 
    path: 'login', 
    loadComponent: () => import('./componentes/login/login').then(m => m.LoginComponent) 
  },
  { 
    path: 'registro', 
    loadComponent: () => import('./componentes/registro/registro').then(m => m.RegistroComponent) 
  },
  { 
    path: 'admin', 
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./componentes/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard)
      },
      { 
        path: 'peliculas', 
        loadComponent: () => import('./componentes/panel-admin/panel-admin').then(m => m.AdminPanel) 
      },
      { 
        path: 'funciones', 
        loadComponent: () => import('./componentes/funciones-admin/funciones-admin').then(m => m.FuncionesAdminComponent) 
      },
      { 
        path: 'candy', 
        loadComponent: () => import('./componentes/candy-admin/candy-admin').then(m => m.CandyAdminComponent) 
      }   
    ]
  },
  { 
    path: '**', 
    redirectTo: '', 
    pathMatch: 'full' 
  }
];