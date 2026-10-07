import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../servicios/supabase';

export const empleadoGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  const perfil = await supabaseService.obtenerPerfilUsuario();

  return perfil?.rol === 'empleado' ? true : router.createUrlTree(['/']);
};

export const personalGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  const perfil = await supabaseService.obtenerPerfilUsuario();

  if (perfil?.rol === 'empleado') return router.createUrlTree(['/empleado/verificador']);
  return perfil?.rol === 'admin' ? true : router.createUrlTree(['/']);
};