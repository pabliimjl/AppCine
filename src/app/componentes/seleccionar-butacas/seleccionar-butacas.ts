import { Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';

export interface Asiento {
  id: string;
  fila: string;
  numero: number;
  tipo: 'regular' | 'accesible' | 'vip';
  estado: 'libre' | 'ocupado' | 'seleccionado';
}

@Component({
  selector: 'app-seleccion-butacas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seleccionar-butacas.html',
  styleUrls: ['./seleccionar-butacas.scss']
})
export class SeleccionButacasComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);

  filas = ['A','B','C','D','E','F','G','H','I','J','L','M','N','O','P','Q','R','S','T'];
  mapaButacas = signal<{ fila: string; asientos: Asiento[] }[]>([]);
  butacasSeleccionadas = signal<Asiento[]>([]);

  funcionId = signal<string | null>(null);
  totalPagar = signal<number>(0);
  entradasAComprar = signal({ general: 0, discapacitado: 0, vip: 0 });
  detalleFuncion = signal<any>(null);
  esCompraAnonima = signal(false);

  // --- VARIABLES DE CONCURRENCIA Y TIEMPO ---
  sesionId = '';
  suscripcionSupabase: any;
  tiempoRestante = signal<number>(300); // 5 minutos
  intervaloTimer: any;
  
  minutosFormat = computed(() => Math.floor(this.tiempoRestante() / 60).toString().padStart(2, '0'));
  segundosFormat = computed(() => (this.tiempoRestante() % 60).toString().padStart(2, '0'));

  seleccionCompleta = computed(() => {
    const permitidas = this.entradasAComprar();
    const seleccionadas = this.butacasSeleccionadas();

    const cantGeneral = seleccionadas.filter(a => a.tipo === 'regular').length;
    const cantAccesible = seleccionadas.filter(a => a.tipo === 'accesible').length;
    const cantVip = seleccionadas.filter(a => a.tipo === 'vip').length;

    return cantGeneral === permitidas.general && 
           cantAccesible === permitidas.discapacitado && 
           cantVip === permitidas.vip;
  });

  constructor() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.entradasAComprar.set(nav.extras.state['entradasSeleccionadas'] || { general: 0, discapacitado: 0, vip: 0 });
      this.totalPagar.set(nav.extras.state['totalPagar'] || 0);
    }
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.funcionId.set(id);
    
    // Obtenemos o creamos el ID de sesión para este usuario
    this.sesionId = this.supabaseService.obtenerSesionId(); 

    if (this.totalPagar() === 0) {
      console.warn('Datos de reserva perdidos. Redirigiendo...');
      this.router.navigate(['/cartelera']); 
      return; 
    }

    if (id) {
      const [data, usuarioActual] = await Promise.all([
        this.supabaseService.obtenerDetalleFuncion(id),
        this.supabaseService.obtenerUsuarioActual()
      ]);
      this.detalleFuncion.set(data);
      this.esCompraAnonima.set(!usuarioActual.data.user);
      
      // Cargamos el estado real de los asientos desde la BD
      await this.cargarEstadoAsientos();

      // Nos suscribimos a los cambios en tiempo real
      this.suscripcionSupabase = this.supabaseService.suscribirseCambiosButacas(
        id, 
        () => this.cargarEstadoAsientos()
      );
    }
  }

  ngOnDestroy() {
    // Limpiamos la suscripción y el timer al salir de la pantalla
    if (this.suscripcionSupabase) this.suscripcionSupabase.unsubscribe();
    if (this.intervaloTimer) clearInterval(this.intervaloTimer);
  }

  // --- LÓGICA DEL MAPA Y BLOQUEOS ---

  generarMapa() {
    const mapa = this.filas.map(letraFila => {
      const asientos: Asiento[] = [];
      const esFilaEspecial = letraFila === 'J';
      const cantidadAsientos = esFilaEspecial ? 14 : 28; 

      for (let i = 1; i <= cantidadAsientos; i++) {
        let tipo: 'regular' | 'accesible' | 'vip' = 'regular';

        if (esFilaEspecial) {
          tipo = 'accesible';
        } else {
          if (['R', 'S', 'T'].includes(letraFila)) {
            tipo = 'vip';
          }
        }

        asientos.push({
          id: `${letraFila}${i}`,
          fila: letraFila,
          numero: i,
          tipo,
          estado: 'libre'
        });
      }
      return { fila: letraFila, asientos };
    });

    this.mapaButacas.set(mapa);
  }

  async cargarEstadoAsientos() {
    this.generarMapa(); 
    
    if (!this.funcionId()) return;
    
    const ocupadas = await this.supabaseService.obtenerButacasOcupadas(this.funcionId()!);
    
    this.mapaButacas.update(mapa => {
      return mapa.map(fila => {
        fila.asientos.forEach(asiento => {
          const bloqueo = ocupadas.find(o => o.butaca_id === asiento.id);
          
          if (bloqueo) {
            if (bloqueo.sesion_id === this.sesionId) {
              asiento.estado = 'seleccionado';
              if (!this.butacasSeleccionadas().find(b => b.id === asiento.id)) {
                this.butacasSeleccionadas.update(s => [...s, asiento]);
              }
            } else {
              asiento.estado = 'ocupado';
            }
          }
        });
        return fila;
      });
    });
  }

  columnaButaca(fila: string, indice: number): string {
    if (fila === 'J') {
      if (indice < 2) return `${indice * 2 + 1} / span 2`;
      if (indice < 12) return `${6 + (indice - 2) * 2} / span 2`;
      return `${27 + (indice - 12) * 2} / span 2`;
    }

    if (indice < 4) return String(indice + 1);
    if (indice < 24) return String(indice + 2);
    return String(indice + 3);
  }

  async toggleAsiento(asiento: Asiento) {
    if (asiento.estado === 'ocupado') return;

    const tipoReserva = asiento.tipo === 'regular' ? 'general' : 
                        asiento.tipo === 'accesible' ? 'discapacitado' : 'vip';

    if (asiento.estado === 'libre') {
      const cantidadPermitida = this.entradasAComprar()[tipoReserva];
      const cantidadActual = this.butacasSeleccionadas().filter(a => a.tipo === asiento.tipo).length;

      if (cantidadActual < cantidadPermitida) {
        
        // Bloqueo en Base de Datos
        const exito = await this.supabaseService.intentarBloquearButaca(this.funcionId()!, asiento.id, this.sesionId);
        
        if (exito) {
          asiento.estado = 'seleccionado';
          this.butacasSeleccionadas.update(s => [...s, asiento]);
          this.iniciarTemporizador();
        } else {
          alert('Lo sentimos, alguien más acaba de reservar esta butaca.');
          this.cargarEstadoAsientos();
        }

      } else {
        alert(`Ya seleccionaste todas tus entradas para la categoría: ${tipoReserva.toUpperCase()}`);
      }

    } else if (asiento.estado === 'seleccionado') {
      
      // Liberar en Base de Datos
      await this.supabaseService.liberarButaca(this.funcionId()!, asiento.id, this.sesionId);
      asiento.estado = 'libre';
      this.butacasSeleccionadas.update(s => s.filter(a => a.id !== asiento.id));
      
    }
  }

  iniciarTemporizador() {
    if (this.intervaloTimer) clearInterval(this.intervaloTimer);
    
    this.tiempoRestante.set(300);
    
    this.intervaloTimer = setInterval(() => {
      this.tiempoRestante.update(t => t - 1);
      
      if (this.tiempoRestante() <= 0) {
        clearInterval(this.intervaloTimer);
        alert('El tiempo de reserva ha expirado. Las butacas han sido liberadas.');
        this.router.navigate(['/cartelera']);
      }
    }, 1000);
  }

  continuarAlCandy() {
    if (!this.seleccionCompleta()) return;

    this.router.navigate(['/candy', this.funcionId()], {
      state: {
        entradasSeleccionadas: this.entradasAComprar(),
        butacas: this.butacasSeleccionadas(),
        totalAcumulado: this.totalPagar()
      }
    });
  }

  async volverAReserva() {
    const idFuncion = this.funcionId();
    if (!idFuncion) return;

    await this.supabaseService.liberarButacasDeSesion(idFuncion, this.sesionId);
    this.router.navigate(['/reserva', idFuncion], {
      state: { entradasSeleccionadas: this.entradasAComprar() }
    });
  }

  async cancelarCompra() {
    const idFuncion = this.funcionId();
    if (idFuncion) {
      await this.supabaseService.liberarButacasDeSesion(idFuncion, this.sesionId);
    }
    this.router.navigate(['/']);
  }
}