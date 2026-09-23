import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe], 
  templateUrl: './cartelera.html',
  styleUrls: ['./cartelera.scss']
})
export class Cartelera implements OnInit {
  funcionesTotales: any[] = [];
  peliculasMostradas: any[] = [];
  
  // Array completo de días futuros
  todosLosDias: { fechaFull: Date; etiqueta: string }[] = [];
  
  // Los 4 días que se ven en pantalla actualmente
  diasVisibles: { fechaFull: Date; etiqueta: string }[] = [];
  
  diaSeleccionado!: Date; 
  indiceActual: number = 0; // Controla qué grupo de 4 días estamos viendo

  // Inyectamos el detector de cambios
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private carteleraService: SupabaseService, 
    private datePipe: DatePipe
  ) {}

  async ngOnInit() {
    this.generarTodosLosDias();
    this.actualizarDiasVisibles();
    
    try {
      // Obtenemos todas las funciones futuras desde Supabase
      this.funcionesTotales = await this.carteleraService.obtenerPeliculasEnCartelera();
      this.filtrarFuncionesPorDia(this.diaSeleccionado);
      
      // Le avisamos a Angular que los datos llegaron y debe actualizar el HTML ahora mismo
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al cargar la cartelera', error);
    }
  }

  generarTodosLosDias() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); 

    // Generamos 15 días hacia adelante
    for (let i = 0; i < 15; i++) { 
      const fechaDia = new Date(hoy);
      fechaDia.setDate(hoy.getDate() + i);

      let etiquetaStr = '';
      if (i === 0) {
        etiquetaStr = 'Hoy';
      } else if (i === 1) {
        etiquetaStr = 'Mañana';
      } else {
        // Formato ej: "lun. 21". Si no tienes español configurado en Angular, saldrá en inglés ("Mon 21").
        etiquetaStr = this.datePipe.transform(fechaDia, 'EEE d') || ''; 
      }

      this.todosLosDias.push({
        fechaFull: fechaDia,
        etiqueta: etiquetaStr
      });
    }

    // Seleccionar 'Hoy' por defecto
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
    this.filtrarFuncionesPorDia(dia);
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

    // 1. Filtramos las funciones totales para quedarnos solo con las del día seleccionado
    const funcionesDelDia = this.funcionesTotales.filter(funcion => 
      this.esMismoDia(diaFiltro, funcion.fecha_hora_inicio)
    );

    // 2. Agrupamos esas funciones por película
    for (const funcion of funcionesDelDia) {
      const peli = funcion.peliculas;
      
      if (!peliculasMap.has(peli.id)) {
        peliculasMap.set(peli.id, {
          ...peli,
          horarios: [] 
        });
      }
      
      // Añadimos la hora de inicio de la función al array de horarios
      peliculasMap.get(peli.id).horarios.push(funcion.fecha_hora_inicio);
    }

    // 3. Ordenamos cronológicamente los horarios dentro de cada película
    Array.from(peliculasMap.values()).forEach(p => {
       p.horarios.sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
    });

    // 4. Convertimos a array y ordenamos las películas por estreno (las más nuevas primero)
    this.peliculasMostradas = Array.from(peliculasMap.values()).sort((a: any, b: any) => {
      return new Date(b.fecha_estreno).getTime() - new Date(a.fecha_estreno).getTime();
    });
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