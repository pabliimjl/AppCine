import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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

  estadoUsuario = toSignal(this.supabase.estadoUsuario$, { 
    initialValue: { logeado: false, nombre: null } 
  });

  estaLogeado = computed(() => this.estadoUsuario().logeado);
  nombreUsuario = computed(() => this.estadoUsuario().nombre);


  cerrarSesion() {
    this.supabase.cerrarSesion();
  }
}