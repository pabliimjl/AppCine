  import { Routes } from '@angular/router';
  import { LoginComponent } from './componentes/login/login';
  import { RegistroComponent } from './componentes/registro/registro';
  import { AdminDashboard } from './componentes/admin-dashboard/admin-dashboard';
  import { AdminPanel } from './componentes/panel-admin/panel-admin'; // Formulario de películas
  import { CandyAdminComponent } from './componentes/candy-admin/candy-admin'; // Formulario de Candy Bar
  import { FuncionesAdminComponent } from './componentes/funciones-admin/funciones-admin';
  import { adminGuard } from './guards/admin-guard';
  import { BienvenidaCine } from './componentes/bienvenida-cine/bienvenida-cine';

  export const routes: Routes = [
    { path: '', 
          component: BienvenidaCine,
          title: 'Bienvenido - App de Cine' // Angular 14+ permite cambiar el título de la pestaña aquí
        }, 
    { path: 'login', component: LoginComponent },
    { path: 'registro', component: RegistroComponent },
    { 
      path: 'admin', 
      canActivate: [adminGuard],
      children: [
        {path: '',component:AdminDashboard},
                // Vista principal con botones de acceso
        { path: 'peliculas', component: AdminPanel },       // Gestión de películas
        { path: 'funciones', component: FuncionesAdminComponent },
        { path: 'candy', component: CandyAdminComponent }   // Gestión de Candy Bar y Combos
        
      ]
    },
    { path: '**', 
          redirectTo: '', 
          pathMatch: 'full' 
    }
  ];