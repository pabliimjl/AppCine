import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-verificador',
  standalone: true,
  imports: [CommonModule, FormsModule, ZXingScannerModule],
  templateUrl: './verificador.html',
  styleUrls: ['./verificador.scss']
})

export class VerificadorComponent {
  private supabaseService = inject(SupabaseService);

  codigoIngresado = signal<string>('');
  reserva = signal<any>(null);
  cargando = signal<boolean>(false);
  error = signal<string>('');
  camaraActiva = signal<boolean>(false);

  // Se ejecuta cuando el escáner detecta un QR
  onCodigoEscaneado(codigo: string) {
    if (codigo) {
      this.camaraActiva.set(false); // Apagar cámara tras leer
      this.codigoIngresado.set(codigo);
      this.buscarReserva();
    }
  }

  async buscarReserva() {
    if (!this.codigoIngresado()) return;
    
    this.cargando.set(true);
    this.error.set('');
    this.reserva.set(null);

    try {
      // Reutilizamos el método que ya tienes para obtener detalles
      const datos = await this.supabaseService.obtenerDetallesReservaPorId(this.codigoIngresado());

      if (datos) {
        if (datos.canceladaEn) {
          this.error.set('Esta compra fue cancelada y sus entradas ya no son válidas.');
        } else {
          this.reserva.set(datos);
        }
      } else {
        this.error.set('Reserva no encontrada');
      }
    } catch (err) {
      this.error.set('Error al buscar la reserva');
    } finally {
      this.cargando.set(false);
    }
  }

 async alternarEstado(campo: 'entradas_retiradas' | 'candy_retirado') {
    const reservaActual = this.reserva();
    const idReserva = this.codigoIngresado();

    // Verificamos que tengamos los datos
    if (!reservaActual || !idReserva) return; 

    // BLOQUEO SEGURIDAD: Si ya está marcado como entregado, no hacemos nada.
    if (reservaActual[campo] === true) {
      return; 
    }

    this.cargando.set(true);
    // Como solo dejamos avanzar hacia "entregado", el nuevo estado siempre será true
    const nuevoEstado = true; 

    try {
      await this.supabaseService.actualizarEstadoEntrega(idReserva, campo, nuevoEstado);
      
      // Actualizamos el estado local para que la vista refleje el cambio
      this.reserva.set({
        ...reservaActual,
        [campo]: nuevoEstado
      });
    } catch (err) {
      console.error(err);
      this.error.set('Error al actualizar el estado en la base de datos');
    } finally {
      this.cargando.set(false);
    }
  }
  
  toggleCamara() {
    this.camaraActiva.update(estado => !estado);
    this.error.set('');
  }
  onCamaraNoEncontrada(event: any) {
    this.camaraActiva.set(false);
    this.error.set('No se encontró una cámara en este dispositivo.');
  }

  onPermisosDenegados(event: boolean) {
    if (!event) { // Si event es false, denegaron el permiso
      this.camaraActiva.set(false);
      this.error.set('Permiso de cámara denegado por el navegador.');
    }
  }
}