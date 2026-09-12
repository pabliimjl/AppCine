import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SupabaseService } from '../servicios/supabase';

export const adminGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const perfil = await supabaseService.obtenerPerfilUsuario();

  // Verificamos si existe el usuario y su rol es 'admin'
  if (perfil && perfil.rol === 'admin') {
    return true; // ¡Pase libre!
    
  }

  // Si no es admin, lo mandamos a la cartelera o login
  alert('Acceso denegado. Se requieren permisos de administrador.');
  router.navigate(['/']); 
  return false;
};