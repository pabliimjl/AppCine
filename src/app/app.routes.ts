import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-guard';
import { sessionGuard } from './guards/session-guard';
import { PagoComponent } from './componentes/pago/pago';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./componentes/cartelera/cartelera').then(m => m.Cartelera),
    title: 'Bienvenido - Cartelera' 
  }, 
  {path:'compra/:id',
    loadComponent:() => import('./componentes/seleccionar-butacas/seleccionar-butacas').then(m=>m.SeleccionButacasComponent),
    title:'Compra de entradas'
  },
  {
    path: 'reserva/:id',
    loadComponent: () => 
      import('./componentes/reserva/reserva').then(m => m.ReservaComponent)
  },
  {
    path: 'pago/:id',
    loadComponent:()=> import('./componentes/pago/pago').then(m=>PagoComponent)
  },
  {
    path: 'entrada/:id',
    loadComponent: () => import('./componentes/entrada/entrada').then(m => m.EntradaComponent)
  },
  {
    path: 'verificador',
    loadComponent: () => import('./componentes/verificador/verificador').then(m => m.VerificadorComponent)
  },
  {
    path: 'perfil',
    canActivate: [sessionGuard],
    loadComponent: () => import('./componentes/perfil-usuario/perfil-usuario').then(m => m.PerfilUsuarioComponent),
    title: 'Mi Perfil'
  },
  { 
    path: 'login', 
    loadComponent: () => import('./componentes/login/login').then(m => m.LoginComponent) 
  },
  { 
    path: 'registro', 
    loadComponent: () => import('./componentes/registro/registro').then(m => m.RegistroComponent) 
  },{
    path: 'candy/:id',
    loadComponent: () => import('./componentes/candy/candy').then(m => m.CandyComponent)
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
      },
      {
        path: 'cupones',
        loadComponent: () => import('./componentes/gestionar-cupones/gestionar-cupones').then(m => m.GestionarCuponesComponent),
        title: 'Gestionar cupones y descuentos'
      },
      {
        path: 'log',
        loadComponent: () => import('./componentes/gestionar-log/gestionar-log').then(m => m.GestionarLogComponent),
        title: 'Gestionar log'
      }   
    ]
  },
  { 
    path: '**', 
    redirectTo: '', 
    pathMatch: 'full' 
  }
];