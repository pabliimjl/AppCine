import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';

interface PerfilGestionable {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'usuario' | 'empleado' | 'admin';
}

@Component({
  selector: 'app-gestion-empleados',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './gestion-empleados.html',
  styleUrls: ['./gestion-empleados.scss']
})
export class GestionEmpleadosComponent implements OnInit {
  private supabase = inject(SupabaseService);

  perfiles = signal<PerfilGestionable[]>([]);
  busqueda = signal('');
  perfilesFiltrados = computed(() => {
    const consulta = this.normalizarTexto(this.busqueda().trim());
    if (!consulta) return this.perfiles();

    return this.perfiles().filter(perfil =>
      this.normalizarTexto(`${perfil.nombre} ${perfil.apellido} ${perfil.email}`).includes(consulta)
    );
  });
  cargando = signal(true);
  procesandoId = signal<string | null>(null);
  mensaje = signal<string | null>(null);
  error = signal<string | null>(null);

  actualizarBusqueda(event: Event) {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  private normalizarTexto(texto: string) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  }

  async ngOnInit() {
    await this.cargarPerfiles();
  }

  async cargarPerfiles() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.perfiles.set(await this.supabase.obtenerPerfilesParaGestionEmpleados() as PerfilGestionable[]);
    } catch {
      this.error.set('No se pudo cargar la lista de usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarRol(perfil: PerfilGestionable) {
    if (perfil.rol === 'admin' || this.procesandoId()) return;

    const nuevoRol = perfil.rol === 'empleado' ? 'usuario' : 'empleado';
    this.procesandoId.set(perfil.id);
    this.mensaje.set(null);
    this.error.set(null);
    try {
      await this.supabase.actualizarRolPerfil(perfil.id, nuevoRol);
      this.perfiles.update(perfiles => perfiles.map(actual =>
        actual.id === perfil.id ? { ...actual, rol: nuevoRol } : actual
      ));
      this.mensaje.set(nuevoRol === 'empleado'
        ? `${perfil.nombre} ahora tiene rol de empleado.`
        : `Se quitó el rol de empleado a ${perfil.nombre}.`);
    } catch {
      this.error.set('No se pudo actualizar el rol. Inténtalo de nuevo.');
    } finally {
      this.procesandoId.set(null);
    }
  }
}