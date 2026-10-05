import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, QRCodeComponent],
  templateUrl: './perfil-usuario.html',
  styleUrls: ['./perfil-usuario.scss']
})
export class PerfilUsuarioComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);

  email = signal('');
  diasVacaciones = signal<number | null>(null);
  creditos = signal(0);
  puntos = signal(0);
  valorPuntoPesos = signal(1);
  compras = signal<any[]>([]);
  movimientosCreditos = signal<any[]>([]);
  movimientosPuntos = signal<any[]>([]);
  resenas = signal<any[]>([]);
  seccionActiva = signal<'datos' | 'creditos' | 'puntos' | 'compras' | 'peliculas'>('datos');
  peliculaResenaActiva = signal<string | null>(null);
  compraCancelando = signal<string | null>(null);
  qrCompraVisible = signal<string | null>(null);
  puntosACanjear = signal(0);
  canjeandoPuntos = signal(false);
  cargando = signal(true);
  guardando = signal(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  mensajeCuenta = signal<string | null>(null);

  peliculasHistorial = computed(() => {
    const peliculas = new Map<string, any>();
    for (const compra of this.compras()) {
      if (!compra.cancelada_en && compra.pelicula?.id && !peliculas.has(compra.pelicula.id)) {
        peliculas.set(compra.pelicula.id, {
          ...compra.pelicula,
          fecha_hora_inicio: compra.fecha_hora_inicio,
          entradas_retiradas: compra.entradas_retiradas
        });
      }
    }
    return Array.from(peliculas.values());
  });

  perfilForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    apellido: ['', [Validators.required, Validators.maxLength(80)]],
    fecha_nacimiento: ['', Validators.required],
    tipo_sangre: ['', [Validators.required, Validators.maxLength(10)]],
    color_ojos: ['', [Validators.required, Validators.maxLength(40)]]
  });

  async ngOnInit() {
    try {
      const [usuario, perfil, compras, movimientos, puntosMovimientos, resenas, configuracion] = await Promise.all([
        this.supabaseService.obtenerUsuarioActual(),
        this.supabaseService.obtenerPerfilUsuario(),
        this.supabaseService.obtenerComprasUsuario(),
        this.supabaseService.obtenerMovimientosCreditos(),
        this.supabaseService.obtenerMovimientosPuntos(),
        this.supabaseService.obtenerResenasUsuario(),
        this.supabaseService.obtenerConfiguracionDescuentos()
      ]);

      this.email.set(usuario.data.user?.email ?? '');
      if (!perfil) {
        this.mensajeError.set('No se pudieron cargar los datos del perfil.');
        return;
      }

      this.perfilForm.patchValue({
        nombre: perfil.nombre ?? '',
        apellido: perfil.apellido ?? '',
        fecha_nacimiento: perfil.fecha_nacimiento ?? '',
        tipo_sangre: perfil.tipo_sangre ?? '',
        color_ojos: perfil.color_ojos ?? ''
      });
      this.diasVacaciones.set(perfil.dias_vacaciones ?? null);
      this.creditos.set(Number(perfil.creditos ?? 0));
      this.puntos.set(Number(perfil.puntos ?? 0));
      this.valorPuntoPesos.set(Number(configuracion.valorPuntoPesos ?? 1));
      this.compras.set(compras);
      this.movimientosCreditos.set(movimientos);
      this.movimientosPuntos.set(puntosMovimientos);
      this.resenas.set(resenas);
    } catch (error) {
      console.error('Error al cargar el perfil:', error);
      this.mensajeError.set('No se pudieron cargar los datos del perfil.');
    } finally {
      this.cargando.set(false);
    }
  }

  async guardarPerfil() {
    if (this.perfilForm.invalid || this.guardando()) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    try {
      const { error } = await this.supabaseService.actualizarPerfilUsuario(
        this.perfilForm.getRawValue() as {
          nombre: string;
          apellido: string;
          fecha_nacimiento: string;
          tipo_sangre: string;
          color_ojos: string;
        }
      );

      if (error) throw error;
      this.mensajeExito.set('Perfil actualizado.');
    } catch (error: any) {
      console.error('Error al actualizar el perfil:', error);
      this.mensajeError.set(error?.message || 'No se pudo actualizar el perfil.');
    } finally {
      this.guardando.set(false);
    }
  }

  seleccionarSeccion(seccion: 'datos' | 'creditos' | 'puntos' | 'compras' | 'peliculas') {
    this.seccionActiva.set(seccion);
    this.mensajeCuenta.set(null);
    this.peliculaResenaActiva.set(null);
  }

  actualizarPuntosACanjear(event: Event) {
    const valor = Number((event.target as HTMLInputElement).value);
    this.puntosACanjear.set(Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0);
  }

  creditosEstimadosPorCanje(): number {
    return Math.round(this.puntosACanjear() * this.valorPuntoPesos() * 100) / 100;
  }

  async canjearPuntos() {
    const puntosCanje = this.puntosACanjear();
    if (this.canjeandoPuntos() || puntosCanje <= 0 || puntosCanje > this.puntos()) {
      this.mensajeCuenta.set('Ingresa una cantidad de puntos válida y disponible.');
      return;
    }

    this.canjeandoPuntos.set(true);
    this.mensajeCuenta.set(null);
    try {
      const { data, error } = await this.supabaseService.canjearPuntosPorCreditos(puntosCanje);
      if (error) throw error;

      const resultado = data as {
        puntos_restantes: number;
        creditos_generados: number;
        saldo_creditos: number;
      };
      this.puntos.set(Number(resultado.puntos_restantes));
      this.creditos.set(Number(resultado.saldo_creditos));
      this.puntosACanjear.set(0);
      this.movimientosPuntos.set(await this.supabaseService.obtenerMovimientosPuntos());
      this.mensajeCuenta.set(`Canje realizado: recibiste ${resultado.creditos_generados} créditos.`);
    } catch (error: any) {
      console.error('Error al canjear puntos:', error);
      this.mensajeCuenta.set(error?.message || 'No se pudieron canjear los puntos.');
    } finally {
      this.canjeandoPuntos.set(false);
    }
  }

  async cancelarCompra(compra: any) {
    if (compra.cancelada_en || compra.entradas_retiradas || compra.candy_retirado || this.compraCancelando()) return;
    if (!window.confirm(`Se devolverán ${compra.total} créditos a tu cuenta. ¿Querés cancelar esta compra?`)) return;

    this.compraCancelando.set(compra.id);
    this.mensajeCuenta.set(null);
    try {
      const { data, error } = await this.supabaseService.cancelarCompraPorCreditos(compra.id);
      if (error) throw error;

      const resultado = data as { importe_devuelto: number; saldo_creditos: number };
      this.creditos.set(Number(resultado.saldo_creditos));
      this.compras.update(compras => compras.map(item => item.id === compra.id
        ? { ...item, cancelada_en: new Date().toISOString() }
        : item));
      this.movimientosCreditos.update(movimientos => [{
        id: `devolucion-${compra.id}`,
        reserva_id: compra.id,
        tipo: 'devolucion',
        importe: resultado.importe_devuelto,
        creado_en: new Date().toISOString()
      }, ...movimientos]);
      this.mensajeCuenta.set(`Compra cancelada. Se acreditaron ${resultado.importe_devuelto} créditos.`);
    } catch (error: any) {
      console.error('Error al cancelar la compra:', error);
      this.mensajeCuenta.set(error?.message || 'No se pudo cancelar la compra.');
    } finally {
      this.compraCancelando.set(null);
    }
  }

  alternarQrCompra(reservaId: string) {
    this.qrCompraVisible.update(actual => actual === reservaId ? null : reservaId);
  }

  puedeResenar(peliculaId: string): boolean {
    return this.compras().some(compra =>
      !compra.cancelada_en && compra.entradas_retiradas && compra.pelicula?.id === peliculaId
    );
  }

  resenaDe(peliculaId: string) {
    return this.resenas().find(resena => resena.pelicula_id === peliculaId);
  }

  iniciarResena(peliculaId: string) {
    const resena = this.resenaDe(peliculaId);
    this.resenaForm.reset({
      puntuacion: resena?.puntuacion ?? 5,
      comentario: resena?.comentario ?? ''
    });
    this.peliculaResenaActiva.set(peliculaId);
    this.mensajeCuenta.set(null);
  }

  cancelarResena() {
    this.peliculaResenaActiva.set(null);
  }

  seleccionarPuntuacion(puntuacion: number) {
    this.resenaForm.controls.puntuacion.setValue(puntuacion);
  }

  async guardarResena() {
    const peliculaId = this.peliculaResenaActiva();
    if (!peliculaId || this.resenaForm.invalid) {
      this.resenaForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensajeCuenta.set(null);
    try {
      const { puntuacion, comentario } = this.resenaForm.getRawValue();
      const { error } = await this.supabaseService.guardarResenaPelicula(
        peliculaId,
        Number(puntuacion),
        comentario ?? ''
      );
      if (error) throw error;

      this.resenas.set(await this.supabaseService.obtenerResenasUsuario());
      this.peliculaResenaActiva.set(null);
      this.mensajeCuenta.set('Reseña guardada.');
    } catch (error: any) {
      console.error('Error al guardar la reseña:', error);
      this.mensajeCuenta.set(error?.message || 'No se pudo guardar la reseña.');
    } finally {
      this.guardando.set(false);
    }
  }

  readonly estrellas = [1, 2, 3, 4, 5];

  resenaForm = this.fb.group({
    puntuacion: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comentario: ['', [Validators.required, Validators.maxLength(240)]]
  });
}
