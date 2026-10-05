import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, AbstractControl,ValidationErrors } from '@angular/forms';
import { CONFIGURACION_DESCUENTOS_POR_DEFECTO, ConfiguracionDescuentos, SupabaseService } from '../../servicios/supabase';

export function validarVencimientoTarjeta(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null; 

  const partes = control.value.split('/');
  if (partes.length !== 2) return null; 

  const mesIngresado = parseInt(partes[0], 10);
  const anioIngresado = parseInt(partes[1], 10) + 2000; // Convierte '26' a 2026

  const fechaActual = new Date();
  const mesActual = fechaActual.getMonth() + 1; // getMonth() devuelve 0-11
  const anioActual = fechaActual.getFullYear();

  if (anioIngresado < anioActual || (anioIngresado === anioActual && mesIngresado < mesActual)) {
    return { tarjetaVencida: true }; 
  }

  return null; 
}

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [CurrencyPipe],
  templateUrl: './pago.html',
  styleUrls: ['./pago.scss']
})
export class PagoComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);

  // Estados con Signals
  funcionId = signal<string | null>(null);
  subtotal = signal<number>(0);
  totalPagar = computed(() => Math.max(0, this.subtotal() - this.importeDescuento()));
  configuracionDescuentos = signal<ConfiguracionDescuentos>(CONFIGURACION_DESCUENTOS_POR_DEFECTO);
  codigoCupon = signal('');
  fechaNacimiento = signal('');
  fechaMaxima = new Date().toISOString().slice(0, 10);
  cuponValido = signal(false);
  importeDescuento = signal(0);
  tipoDescuento = signal<string | null>(null);
  mensajeDescuento = signal<string | null>(null);
  usuarioAutenticado = signal(false);
  saldoCreditos = signal(0);
  usarCreditosParciales = signal(false);
  combinacionDisponible = computed(() =>
    this.usuarioAutenticado() && this.saldoCreditos() > 0 && this.saldoCreditos() < this.totalPagar()
  );
  creditosAplicados = computed(() => this.usarCreditosParciales() && this.combinacionDisponible()
    ? this.saldoCreditos()
    : 0);
  importeMedioExterno = computed(() => Math.max(0, this.totalPagar() - this.creditosAplicados()));
  metodoPago = signal<'mp' | 'tarjeta' | 'creditos' | null>(null);
  mensajeErrorPago = signal<string | null>(null);
  estadoPago = signal<'pendiente' | 'procesando' | 'exito'>('pendiente');
  tipoTarjeta = signal<'visa' | 'mastercard' | 'amex' | 'desconocida'>('desconocida');

  // Guardamos todo el estado anterior para pasarlo a la entrada final
  datosReserva: any;

  // Formulario Reactivo para la Tarjeta
  tarjetaForm: FormGroup = this.fb.group({
    numero: ['', [Validators.required, Validators.pattern(/^[\d\s]{15,19}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    vencimiento: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/),validarVencimientoTarjeta]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
  });

  private formSub: any;

  constructor() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.datosReserva = nav.extras.state;
      this.subtotal.set(nav.extras.state['totalFinal'] || 0);
    }
  }

  async ngOnInit() {
    this.funcionId.set(this.route.snapshot.paramMap.get('id'));

    if (this.subtotal() === 0) {
      this.router.navigate(['/cartelera']);
      return;
    }

    const [configuracion, perfil, usuario] = await Promise.all([
      this.supabaseService.obtenerConfiguracionDescuentos(),
      this.supabaseService.obtenerPerfilUsuario(),
      this.supabaseService.obtenerUsuarioActual()
    ]);
    this.configuracionDescuentos.set(configuracion);
    this.usuarioAutenticado.set(Boolean(usuario.data.user));
    this.saldoCreditos.set(Number(perfil?.creditos ?? 0));
    if (perfil?.fecha_nacimiento) this.fechaNacimiento.set(String(perfil.fecha_nacimiento).slice(0, 10));
    this.recalcularDescuento();

    // Escuchar cambios en el input del número de tarjeta para detectar la marca
    this.formSub = this.tarjetaForm.get('numero')?.valueChanges.subscribe(valor => {
      this.detectarTipoTarjeta(valor.replace(/\s+/g, ''));
    });
  }

  ngOnDestroy() {
    if (this.formSub) this.formSub.unsubscribe();
  }

  // --- LÓGICA DE TARJETAS ---

  detectarTipoTarjeta(numero: string) {
    if (/^4/.test(numero)) {
      this.tipoTarjeta.set('visa');
    } else if (/^5[1-5]/.test(numero) || /^2(?:2(?:2[1-9]|[3-9]\d)|[3-6]\d\d|7(?:[01]\d|20))/.test(numero)) {
      this.tipoTarjeta.set('mastercard');
    } else if (/^3[47]/.test(numero)) {
      this.tipoTarjeta.set('amex');
    } else {
      this.tipoTarjeta.set('desconocida');
    }
  }

  formatearNumeroTarjeta(event: any) {
    // Agrega un espacio cada 4 números automáticamente para mejor UX
    let valor = event.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let formateado = valor.match(/.{1,4}/g)?.join(' ') || valor;
    this.tarjetaForm.get('numero')?.setValue(formateado, { emitEvent: false });
  }

  formatearVencimiento(event: any) {
    // Agrega la barra automáticamente en MM/YY
    let valor = event.target.value.replace(/[^0-9]/gi, '');
    if (valor.length >= 2) {
      valor = valor.substring(0, 2) + '/' + valor.substring(2, 4);
    }
    this.tarjetaForm.get('vencimiento')?.setValue(valor, { emitEvent: false });
  }

  // --- FLUJOS DE PAGO ---

  seleccionarMetodo(metodo: 'mp' | 'tarjeta' | 'creditos') {
    if (this.estadoPago() === 'procesando') return;
    this.metodoPago.set(metodo);
    if (metodo === 'creditos') this.usarCreditosParciales.set(false);
    this.mensajeErrorPago.set(null);
  }

  cambiarUsoCreditos(event: Event) {
    this.usarCreditosParciales.set((event.target as HTMLInputElement).checked);
    this.mensajeErrorPago.set(null);
  }

  async procesarPagoCreditos() {
    if (!this.usuarioAutenticado()) return;
    if (this.saldoCreditos() < this.totalPagar()) {
      this.mensajeErrorPago.set('No tenés créditos suficientes para esta compra.');
      return;
    }

    this.mensajeErrorPago.set(null);
    this.estadoPago.set('procesando');
    await this.finalizarCompraExitosamente();
  }

  actualizarFechaNacimiento(event: Event) {
    this.fechaNacimiento.set((event.target as HTMLInputElement).value);
    this.recalcularDescuento();
  }

  actualizarCodigoCupon(event: Event) {
    this.codigoCupon.set((event.target as HTMLInputElement).value.toUpperCase());
    this.cuponValido.set(false);
    this.recalcularDescuento();
  }

  async aplicarCupon() {
    const configuracion = this.configuracionDescuentos();
    const codigo = this.codigoCupon().trim().toUpperCase();
    this.cuponValido.set(false);

    if (!configuracion.primeraCompraActiva || !codigo || codigo !== configuracion.codigoPrimeraCompra.trim().toUpperCase()) {
      this.mensajeDescuento.set('El código no es válido o no está activo.');
      this.recalcularDescuento();
      return;
    }

    const esPrimeraCompra = await this.supabaseService.esPrimeraCompra(this.supabaseService.obtenerSesionId());
    if (!esPrimeraCompra) {
      this.mensajeDescuento.set('Este cupón solo se puede usar en la primera compra.');
      this.recalcularDescuento();
      return;
    }

    this.cuponValido.set(true);
    this.mensajeDescuento.set('Cupón aplicado. Se usará el descuento más conveniente.');
    this.recalcularDescuento();
  }

  private recalcularDescuento() {
    const configuracion = this.configuracionDescuentos();
    const descuentos: { tipo: string; importe: number }[] = [];

    if (this.cuponValido()) {
      descuentos.push({
        tipo: 'primera_compra',
        importe: Math.round(this.subtotal() * configuracion.descuentoPrimeraCompra / 100)
      });
    }

    const edad = this.calcularEdad(this.fechaNacimiento());
    if (configuracion.mayores50Activos && edad !== null && edad >= configuracion.edadMinima) {
      const totalEntradas = Number(this.datosReserva?.totalEntradas ?? this.subtotal());
      descuentos.push({
        tipo: 'mayores_50',
        importe: Math.round(totalEntradas * configuracion.descuentoMayores50 / 100)
      });
    }

    const mejorDescuento = descuentos.sort((a, b) => b.importe - a.importe)[0];
    this.tipoDescuento.set(mejorDescuento?.tipo ?? null);
    this.importeDescuento.set(mejorDescuento?.importe ?? 0);
  }

  private calcularEdad(fechaNacimiento: string): number | null {
    if (!fechaNacimiento) return null;
    const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
    if (Number.isNaN(nacimiento.getTime()) || nacimiento > new Date()) return null;

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    if (hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  }

  iniciarPagoMercadoPago() {
    this.estadoPago.set('procesando');
    // Simulamos 5 segundos de espera para el QR
    setTimeout(() => {
      this.finalizarCompraExitosamente();
    }, 5000);
  }

  procesarPagoTarjeta() {
    if (this.tarjetaForm.invalid) {
      this.tarjetaForm.markAllAsTouched();
      return;
    }

    this.estadoPago.set('procesando');
    // Simulamos 3 segundos de validación con el banco
    setTimeout(() => {
      this.finalizarCompraExitosamente();
    }, 3000);
  }

  async finalizarCompraExitosamente() {
    this.estadoPago.set('procesando'); // Mantenemos el spinner girando

    // Obtenemos el ID de sesión que usamos en la pantalla de butacas
    const sesionId = this.supabaseService.obtenerSesionId();

    if (this.cuponValido() && !(await this.supabaseService.esPrimeraCompra(sesionId))) {
      this.cuponValido.set(false);
      this.mensajeDescuento.set('El cupón dejó de estar disponible porque ya existe una compra anterior.');
      this.recalcularDescuento();
      this.estadoPago.set('pendiente');
      return;
    }

    let reservaId: string | null;
    const pagaSoloConCreditos = this.metodoPago() === 'creditos';
    const usaCreditosEnPagoCombinado = this.usarCreditosParciales()
      && (this.metodoPago() === 'mp' || this.metodoPago() === 'tarjeta');

    if (pagaSoloConCreditos || usaCreditosEnPagoCombinado) {
      try {
        const resultado = await this.supabaseService.guardarCompraConCreditos(
          this.funcionId()!,
          this.totalPagar(),
          this.datosReserva.butacas,
          this.datosReserva.itemsCandy || [],
          sesionId,
          this.tipoDescuento() === 'primera_compra' ? this.codigoCupon().trim().toUpperCase() : null,
          this.fechaNacimiento() || null,
          pagaSoloConCreditos ? this.totalPagar() : this.creditosAplicados(),
          pagaSoloConCreditos ? null : this.metodoPago() as 'mp' | 'tarjeta'
        );
        reservaId = resultado.reservaId;
        if (resultado.error) this.mensajeErrorPago.set(resultado.error);
        if (resultado.saldoCreditos !== null) this.saldoCreditos.set(resultado.saldoCreditos);
      } catch (error) {
        console.error('Error al pagar con créditos:', error);
        reservaId = null;
        this.mensajeErrorPago.set('No se pudo procesar el pago con créditos.');
      }
    } else {
      reservaId = await this.supabaseService.guardarCompraDefinitiva(
        this.funcionId()!,
        this.totalPagar(),
        this.metodoPago()!,
        this.datosReserva.butacas,
        this.datosReserva.itemsCandy || [],
        sesionId,
        {
          importe: this.importeDescuento(),
          tipo: this.tipoDescuento(),
          codigoCupon: this.tipoDescuento() === 'primera_compra'
            ? this.codigoCupon().trim().toUpperCase()
            : null
        }
      );
    }

    if (reservaId) {
      this.estadoPago.set('exito');
      
      // Redirigimos al ticket final pasándole el ID oficial generado en Supabase
      this.router.navigate(['/entrada', reservaId], {
        state: { 
          ...this.datosReserva, 
          metodo: this.metodoPago(),
          nroReserva: reservaId,
          totalFinal: this.totalPagar(),
          importeDescuento: this.importeDescuento(),
          tipoDescuento: this.tipoDescuento()
        }
      });
    } else {
      // Manejo de error si falla la BD
      if (!this.mensajeErrorPago()) {
        this.mensajeErrorPago.set('Hubo un error al procesar la reserva. Por favor intenta de nuevo.');
      }
      this.estadoPago.set('pendiente'); 
    }
  }

  volverACandy() {
    this.router.navigate(['/candy', this.funcionId()], {
      state: {
        butacas: this.datosReserva.butacas || [],
        totalAcumulado: this.datosReserva.totalEntradas || 0,
        itemsCandy: this.datosReserva.itemsCandy || []
      }
    });
  }

  async cancelarCompra() {
    const idFuncion = this.funcionId();
    if (idFuncion) {
      await this.supabaseService.liberarButacasDeSesion(
        idFuncion,
        this.supabaseService.obtenerSesionId()
      );
    }
    this.router.navigate(['/']);
  }
}