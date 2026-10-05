import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';


@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe, CurrencyPipe],
  templateUrl: './reserva.html',
  styleUrls: ['./reserva.scss']
})
export class ReservaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private carteleraService = inject(SupabaseService);
  private router = inject(Router); 

  funcionId = signal<string | null>(null);
  detalleFuncion = signal<any>(null);
  
  entradas = signal({
    general: 0,
    discapacitado: 0,
    vip: 0
  });

  esPreventa = computed(() => {
    const fechaEstreno = this.detalleFuncion()?.peliculas?.fecha_estreno;
    if (!fechaEstreno) return false;

    const estreno = new Date(`${String(fechaEstreno).slice(0, 10)}T00:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return !Number.isNaN(estreno.getTime()) && estreno > hoy;
  });

  precioBase = computed(() => {
    const pelicula = this.detalleFuncion()?.peliculas;
    const precio = this.esPreventa()
      ? pelicula?.precio_preventa ?? pelicula?.precio_base
      : pelicula?.precio_base;
    return Number(precio ?? 0);
  });
  precioDiscapacitado = computed(() => this.precioBase() * 0.5);
  precioVip = computed(() => this.precioBase() * 1.5);

  totalEntradas = computed(() => {
    const e = this.entradas();
    return e.general + e.discapacitado + e.vip;
  });

  totalPagar = computed(() => {
    const e = this.entradas();
    return (e.general * this.precioBase()) +
           (e.discapacitado * this.precioDiscapacitado()) +
           (e.vip * this.precioVip());
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.funcionId.set(id);
    
    if (id) {
      const data = await this.carteleraService.obtenerDetalleFuncion(id);
      this.detalleFuncion.set(data); 
    }
  }

  cambiarCantidad(tipo: 'general' | 'discapacitado' | 'vip', incremento: number) {
    this.entradas.update(valoresActuales => {
      const nuevaCantidad = valoresActuales[tipo] + incremento;
      
      return {
        ...valoresActuales,
        [tipo]: nuevaCantidad >= 0 ? nuevaCantidad : valoresActuales[tipo]
      };
    });
  }

  confirmarCompra() {
    if (this.totalEntradas() === 0) return;
    
    const idFuncion = this.funcionId();
    
    this.router.navigate(['/compra', idFuncion], {
      state: {
        entradasSeleccionadas: this.entradas(), // { general: 2, discapacitado: 1, vip: 0 }
        totalPagar: this.totalPagar() 
      }
    });
  }
}