import { Component, computed, signal, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';

// Definimos la interfaz del carrito para unificar combos y productos
export interface ItemCarrito {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tipo: 'producto' | 'combo';
}

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [CommonModule],
  providers: [CurrencyPipe],
  templateUrl: './candy.html',
  styleUrls: ['./candy.scss']
})
export class CandyComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);

  // Estado recibido de la navegación
  funcionId = signal<string | null>(null);
  butacasSeleccionadas = signal<any[]>([]);
  totalEntradas = signal<number>(0);

  // Catálogo del Candy
  productos = signal<any[]>([]);
  combos = signal<any[]>([]);

  // Carrito de compras
  carrito = signal<ItemCarrito[]>([]);

  // Cálculos computados
  totalCandy = computed(() => {
    return this.carrito().reduce((total, item) => total + (item.precio * item.cantidad), 0);
  });

  totalFinal = computed(() => {
    return this.totalEntradas() + this.totalCandy();
  });

  constructor() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.butacasSeleccionadas.set(nav.extras.state['butacas'] || []);
      this.totalEntradas.set(nav.extras.state['totalAcumulado'] || 0);
      this.carrito.set(nav.extras.state['itemsCandy'] || []);
    }
  }

  async ngOnInit() {
    this.funcionId.set(this.route.snapshot.paramMap.get('id'));

    if (this.totalEntradas() === 0) {
      console.warn('Datos perdidos. Volviendo a la cartelera...');
      this.router.navigate(['/cartelera']);
      return;
    }

    const menu = await this.supabaseService.obtenerMenuCandy();
    this.productos.set(menu.productos);
    this.combos.set(menu.combos);
  }

  agregarAlCarrito(itemDb: any, tipo: 'producto' | 'combo') {
    // Identificamos el precio correcto según si es combo o producto
    const precio = tipo === 'combo' ? itemDb.precio_combo : itemDb.precio;
    
    this.carrito.update(items => {
      const index = items.findIndex(i => i.id === itemDb.id && i.tipo === tipo);
      
      if (index > -1) {
        // Clonamos el array y actualizamos la cantidad
        const nuevosItems = [...items];
        nuevosItems[index].cantidad++;
        return nuevosItems;
      } else {
        // Agregamos un nuevo ítem
        return [...items, {
          id: itemDb.id,
          nombre: itemDb.nombre,
          precio: precio,
          cantidad: 1,
          tipo: tipo
        }];
      }
    });
  }

  restarDelCarrito(id: string, tipo: 'producto' | 'combo') {
    this.carrito.update(items => {
      const index = items.findIndex(i => i.id === id && i.tipo === tipo);
      if (index === -1) return items;

      const nuevosItems = [...items];
      if (nuevosItems[index].cantidad > 1) {
        nuevosItems[index].cantidad--;
      } else {
        nuevosItems.splice(index, 1);
      }
      return nuevosItems;
    });
  }

  obtenerCantidadEnCarrito(id: string, tipo: 'producto' | 'combo'): number {
    const item = this.carrito().find(i => i.id === id && i.tipo === tipo);
    return item ? item.cantidad : 0;
  }

  continuarAlPago() {
    // Enviamos al pago todo el detalle unificado
    this.router.navigate(['/pago', this.funcionId()], {
      state: {
        butacas: this.butacasSeleccionadas(),
        totalEntradas: this.totalEntradas(),
        itemsCandy: this.carrito(),
        totalCandy: this.totalCandy(),
        totalFinal: this.totalFinal()
      }
    });
  }

  volverAButacas() {
    const butacas = this.butacasSeleccionadas();
    this.router.navigate(['/compra', this.funcionId()], {
      state: {
        entradasSeleccionadas: {
          general: butacas.filter(butaca => butaca.tipo === 'regular').length,
          discapacitado: butacas.filter(butaca => butaca.tipo === 'accesible').length,
          vip: butacas.filter(butaca => butaca.tipo === 'vip').length
        },
        totalPagar: this.totalEntradas()
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