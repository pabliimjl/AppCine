import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../servicios/supabase';

export const adminGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const perfil = await supabaseService.obtenerPerfilUsuario();

  if (perfil && perfil.rol === 'admin') {
    return true; 
    
  }

  alert('Acceso denegado. Se requieren permisos de administrador.');
  router.navigate(['/']); 
  return false;
};