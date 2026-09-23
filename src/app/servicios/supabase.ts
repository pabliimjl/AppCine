import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs'; // Importante agregar esto

@Injectable({
  providedIn: 'root' 
})
export class SupabaseService {
  private supabase: SupabaseClient;

  // Estado reactivo para la sesión del usuario
  private usuarioActual = new BehaviorSubject<{logeado: boolean, nombre: string | null}>({ logeado: false, nombre: null });
  public estadoUsuario$ = this.usuarioActual.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
    // Verificamos si ya hay alguien logueado al recargar la página
    this.verificarSesionInicial();
  }

  // --- NUEVO: Chequeo inicial ---
  private async verificarSesionInicial() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session && session.user) {
      const perfil = await this.obtenerPerfilUsuario();
      this.usuarioActual.next({ logeado: true, nombre: perfil?.nombre || 'Usuario' });
    }
  }

  // --- NUEVO: Cerrar Sesión ---
  async cerrarSesion() {
    await this.supabase.auth.signOut();
    this.usuarioActual.next({ logeado: false, nombre: null });
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

  async login(email: string, password: string) {
    const respuesta = await this.supabase.auth.signInWithPassword({ email, password });
    
    // Si el login es exitoso, actualizamos el estado reactivo
    if (respuesta.data.session) {
      const perfil = await this.obtenerPerfilUsuario();
      this.usuarioActual.next({ logeado: true, nombre: perfil?.nombre || 'Usuario' });
    }

    return respuesta;
  }

  async registrarUsuario(usuarioData: any, password: string) {
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: usuarioData.email,
      password,
    });

    if (authError) return { error: authError };

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

      // Si el registro es exitoso y el perfil se creó, actualizamos el estado
      this.usuarioActual.next({ logeado: true, nombre: usuarioData.nombre });
    }

    return { data: authData, error: null };
  }

  async obtenerPerfilUsuario() {
    const { data: { user } } = await this.supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error al obtener perfil:', error.message);
      return null;
    }

    return data; 
  }

  async obtenerPeliculasEnCartelera() {
    const hoy = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('funciones')
      .select(`
        id,
        fecha_hora_inicio,
        peliculas (
          id,
          nombre,
          imagen,
          fecha_estreno,
          generos
        )
      `)
      .gte('fecha_hora_inicio', hoy); 
      
    if (error) throw error;
    return data;
  }
}