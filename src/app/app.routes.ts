  import { Routes } from '@angular/router';
  import { LoginComponent } from './componentes/login/login';
  import { RegistroComponent } from './componentes/registro/registro';
  import { AdminDashboard } from './componentes/admin-dashboard/admin-dashboard';
  import { AdminPanel } from './componentes/panel-admin/panel-admin'; 
  import { CandyAdminComponent } from './componentes/candy-admin/candy-admin'; 
  import { FuncionesAdminComponent } from './componentes/funciones-admin/funciones-admin';
  import { adminGuard } from './guards/admin-guard';
  import { BienvenidaCine } from './componentes/bienvenida-cine/bienvenida-cine';

  export const routes: Routes = [ //agregar lazy loading
    
    { path: '', 
          component: BienvenidaCine,
          title: 'Bienvenido - App de Cine' 
        }, 
    { path: 'login', component: LoginComponent },
    { path: 'registro', component: RegistroComponent },
    { 
      path: 'admin', 
      canActivate: [adminGuard],
      children: [
        {path: '',component:AdminDashboard},
        { path: 'peliculas', component: AdminPanel },
        { path: 'funciones', component: FuncionesAdminComponent },
        { path: 'candy', component: CandyAdminComponent }   

      ]
    },
    { path: '**', 
          redirectTo: '', 
          pathMatch: 'full' 
    }
  ];