import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DOCUMENT, KeyValuePipe } from '@angular/common'; 
import { SupabaseService } from '../../servicios/supabase';
import { RouterLink } from '@angular/router';
import { EstrenosComponent } from '../estrenos/estrenos';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, KeyValuePipe,RouterLink, EstrenosComponent], 
  providers: [DatePipe], 
  templateUrl: './cartelera.html',
  styleUrls: ['./cartelera.scss']
})
export class Cartelera implements OnInit {
  funcionesTotales: any[] = [];
  peliculasMostradas: any[] = [];
  peliculasDelDia: any[] = []; 
  
  todosLosDias: { fechaFull: Date; etiqueta: string }[] = [];
  diasVisibles: { fechaFull: Date; etiqueta: string }[] = [];
  
  diaSeleccionado!: Date; 
  indiceActual: number = 0;

  terminoBusqueda: string = ''; 
  mensajePreventa: string | null = null;
  
  conteoGeneros: Record<string, number> = {};
  generosSeleccionados: string[] = []; 

  private cdr = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);
  private cargaInicial: Promise<void> = Promise.resolve();

  constructor(
    private carteleraService: SupabaseService, 
    private datePipe: DatePipe
  ) {}

  async ngOnInit() {
    this.generarTodosLosDias();
    this.actualizarDiasVisibles();

    this.cargaInicial = this.cargarDatosIniciales();
    await this.cargaInicial;
  }

  private async cargarDatosIniciales() {
    try {
      const [funciones, generos] = await Promise.all([
        this.carteleraService.obtenerPeliculasEnCartelera(),
        this.carteleraService.obtenerConteoGenerosFunciones()
      ]);

      this.funcionesTotales = funciones;
      this.conteoGeneros = generos; 
      
      this.filtrarFuncionesPorDia(this.diaSeleccionado);
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar la cartelera', error);
    }
  }

  toggleGenero(genero: string) {
    const index = this.generosSeleccionados.indexOf(genero);
    
    if (index > -1) {
      this.generosSeleccionados.splice(index, 1);
    } else {
      this.generosSeleccionados.push(genero);
    }
    
    this.aplicarFiltroMultiple();
  }

  etiquetaGenerosSeleccionados(): string {
    if (this.generosSeleccionados.length === 0) return 'Todos los géneros';
    if (this.generosSeleccionados.length === 1) return this.generosSeleccionados[0];
    return `${this.generosSeleccionados.length} géneros seleccionados`;
  }

  actualizarBusqueda(event: Event) {
    const input = event.target as HTMLInputElement;
    this.terminoBusqueda = input.value;
    this.aplicarFiltros();
  }

 
  aplicarFiltros() {
    // 1. Partimos de todas las películas del día
    let filtradas = [...this.peliculasDelDia];

    // 2. Aplicamos el filtro de géneros si hay alguno seleccionado
    if (this.generosSeleccionados.length > 0) {
      filtradas = filtradas.filter(peli => {
        if (!peli.generos) return false;
        return peli.generos.some((generoPeli: string) => 
          this.generosSeleccionados.includes(generoPeli)
        );
      });
    }

    // 3. Aplicamos el filtro de búsqueda por texto
    if (this.terminoBusqueda.trim() !== '') {
      const termino = this.terminoBusqueda.toLowerCase().trim();
      filtradas = filtradas.filter(peli => 
        peli.nombre.toLowerCase().includes(termino)
      );
    }

    // 4. Asignamos el resultado final a la vista
    this.peliculasMostradas = filtradas;
  }
  
  aplicarFiltroMultiple() {
    this.aplicarFiltros();
  }

  generarTodosLosDias() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); 
    
    for (let i = 0; i < 15; i++) { 
      const fechaDia = new Date(hoy);
      fechaDia.setDate(hoy.getDate() + i);

      let etiquetaStr = '';
      if (i === 0) {
        etiquetaStr = 'Hoy';
      } else if (i === 1) {
        etiquetaStr = 'Mañana';
      } else {
        etiquetaStr = this.datePipe.transform(fechaDia, 'EEE d') || ''; 
      }

      this.todosLosDias.push({
        fechaFull: fechaDia,
        etiqueta: etiquetaStr
      });
    }

    this.diaSeleccionado = this.todosLosDias[0].fechaFull;
  }

  actualizarDiasVisibles() {
    this.diasVisibles = this.todosLosDias.slice(this.indiceActual, this.indiceActual + 4);
  }

  siguienteDia() {
    if (this.indiceActual + 4 < this.todosLosDias.length) {
      this.indiceActual++;
      this.actualizarDiasVisibles();
    }
  }

  diaAnterior() {
    if (this.indiceActual > 0) {
      this.indiceActual--;
      this.actualizarDiasVisibles();
    }
  }

  seleccionarDia(dia: Date) {
    this.diaSeleccionado = dia;
    this.mensajePreventa = null;
    this.filtrarFuncionesPorDia(dia);
  }

  async seleccionarPrimeraFuncion(peliculaId: string) {
    await this.cargaInicial;

    const primeraFuncion = this.funcionesTotales
      .filter(funcion => funcion.peliculas?.id === peliculaId)
      .sort((a, b) => new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime())[0];

    if (!primeraFuncion) {
      this.mensajePreventa = 'Todavía no hay funciones programadas para esta película.';
      return;
    }

    const fechaFuncion = new Date(primeraFuncion.fecha_hora_inicio);
    fechaFuncion.setHours(0, 0, 0, 0);

    let indiceFecha = this.todosLosDias.findIndex(dia => this.esMismoDia(dia.fechaFull, fechaFuncion));
    if (indiceFecha === -1) {
      const ultimoDia = new Date(this.todosLosDias[this.todosLosDias.length - 1].fechaFull);
      ultimoDia.setDate(ultimoDia.getDate() + 1);

      while (ultimoDia <= fechaFuncion) {
        this.todosLosDias.push({
          fechaFull: new Date(ultimoDia),
          etiqueta: this.datePipe.transform(ultimoDia, 'EEE d') || ''
        });
        ultimoDia.setDate(ultimoDia.getDate() + 1);
      }

      indiceFecha = this.todosLosDias.findIndex(dia => this.esMismoDia(dia.fechaFull, fechaFuncion));
    }

    this.indiceActual = Math.min(indiceFecha, Math.max(0, this.todosLosDias.length - 4));
    this.actualizarDiasVisibles();
    this.generosSeleccionados = [];
    this.terminoBusqueda = primeraFuncion.peliculas?.nombre ?? '';
    this.seleccionarDia(this.todosLosDias[indiceFecha].fechaFull);
    this.aplicarFiltros();
    this.cdr.detectChanges();
    this.document.getElementById(`pelicula-${peliculaId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }

  esMismoDia(fecha1: Date, fecha2: string | Date): boolean {
    const d1 = new Date(fecha1);
    const d2 = new Date(fecha2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  filtrarFuncionesPorDia(diaFiltro: Date) {
    const peliculasMap = new Map();

    const funcionesDelDia = this.funcionesTotales.filter(funcion => 
      this.esMismoDia(diaFiltro, funcion.fecha_hora_inicio)
    );

    for (const funcion of funcionesDelDia) {
      const peli = funcion.peliculas;
      
      if (!peliculasMap.has(peli.id)) {
        peliculasMap.set(peli.id, {
          ...peli,
          horarios: [] 
        });
      }
      
      peliculasMap.get(peli.id).horarios.push({
        funcion_id: funcion.id,
        hora: funcion.fecha_hora_inicio
      });
    }

    Array.from(peliculasMap.values()).forEach(p => {
       p.horarios.sort((a: any, b: any) => new Date(a.hora).getTime() - new Date(b.hora).getTime());
    });

    const peliculasOrdenadasPorVentas = Array.from(peliculasMap.values());
    const masVendidas = peliculasOrdenadasPorVentas.slice(0, 3);
    const restoPorEstreno = peliculasOrdenadasPorVentas.slice(3).sort((a: any, b: any) => {
      return new Date(b.fecha_estreno).getTime() - new Date(a.fecha_estreno).getTime();
    });

    this.peliculasDelDia = [...masVendidas, ...restoPorEstreno];

    this.aplicarFiltroMultiple();
  }

  esEstreno(fechaEstreno: string): boolean {
    if (!fechaEstreno) return false;

    const fechaPelicula = new Date(fechaEstreno);
    const hoy = new Date();

    fechaPelicula.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);

    const diferenciaMilisegundos = hoy.getTime() - fechaPelicula.getTime();
    const milisegundosPorDia = 1000 * 60 * 60 * 24;
    const diasDeDiferencia = Math.floor(diferenciaMilisegundos / milisegundosPorDia);

    return diasDeDiferencia <= 15;
  }
}