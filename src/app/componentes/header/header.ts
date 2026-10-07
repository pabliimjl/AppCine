import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { OcultarEnRutas } from '../../directivas/ocultar-en-rutas';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, OcultarEnRutas],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class Header {

  private supabase = inject(SupabaseService);
  private router = inject(Router);
  menuAbierto = signal(false);

  estadoUsuario = toSignal(this.supabase.estadoUsuario$, { 
    initialValue: { logeado: false, nombre: null, esAdmin: false, rol: null }
  });

  estaLogeado = computed(() => this.estadoUsuario().logeado);
  nombreUsuario = computed(() => this.estadoUsuario().nombre);
  esAdmin = computed(() => this.estadoUsuario().rol === 'admin');
  esEmpleado = computed(() => this.estadoUsuario().rol === 'empleado');

  alternarMenu() {
    this.menuAbierto.update(abierto => !abierto);
  }

  cerrarMenu() {
    this.menuAbierto.set(false);
  }

  @HostListener('document:keydown.escape')
  cerrarMenuConEscape() {
    this.cerrarMenu();
  }

  async cerrarSesion() {
    this.cerrarMenu();
    await this.supabase.cerrarSesion();
    await this.router.navigateByUrl('/');
  }
}