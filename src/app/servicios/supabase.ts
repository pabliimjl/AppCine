import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment'; // Ruta hacia tu environment

@Injectable({
  providedIn: 'root' // ¡Esto es clave!
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  async obtenerPeliculas() {
    try {
      const { data, error } = await this.supabase
        .from('peliculas')
        .select('*')
        .order('fecha_estreno', { ascending: false });

      if (error) {
        console.error('Error al obtener las películas:', error.message);
        return []; 
      }

      return data;
    } catch (err) {
      console.error('Error inesperado de red:', err);
      return [];
    }
  }

  // 1. Iniciar Sesión
  async login(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  // 2. Registrar usuario e insertar datos del TP
  async registrarUsuario(usuarioData: any, password: string) {
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: usuarioData.email,
      password,
    });

    if (authError) return { error: authError };

    // Si se creó en auth, guardamos los datos extra en la tabla pública
    if (authData.user) {
      const { error: dbError } = await this.supabase.from('perfiles').insert({
        id: authData.user.id,
        email: usuarioData.email,
        nombre: usuarioData.nombre,
        apellido: usuarioData.apellido,
        fecha_nacimiento: usuarioData.fecha_nacimiento,
        tipo_sangre: usuarioData.tipo_sangre,
        color_ojos: usuarioData.color_ojos,
        dias_vacaciones: usuarioData.dias_vacaciones
      });

      if (dbError) return { error: dbError };
    }

    return { data: authData, error: null };
  }

  async obtenerPerfilUsuario() {
    // Obtenemos el usuario autenticado actual
    const { data: { user } } = await this.supabase.auth.getUser();
    
    if (!user) return null;

    // Consultamos su rol en la tabla perfiles
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error al obtener perfil:', error.message);
      return null;
    }

    return data; // Aquí vendrá el campo { ..., rol: 'admin' }
  }
}