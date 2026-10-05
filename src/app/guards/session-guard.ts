import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../servicios/supabase';

export const sessionGuard: CanActivateFn = async () => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);
  const { data, error } = await supabaseService.obtenerUsuarioActual();

  return !error && data.user ? true : router.createUrlTree(['/login']);
};
