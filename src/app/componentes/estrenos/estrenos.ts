import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-estrenos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estrenos.html',
  styleUrls: ['./estrenos.scss']
})
export class EstrenosComponent implements OnInit {
  // Usamos Signals para mantener reactividad
  peliculasEstreno = signal<any[]>([]);
  @Output() preventaSeleccionada = new EventEmitter<string>();

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.cargarEstrenos();
  }

  async cargarEstrenos() {
    const peliculas = await this.supabaseService.peliculasAEstrenar();
    
    // Obtenemos la fecha local a medianoche para hacer un cálculo preciso
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const peliculasMapeadas = peliculas.map((peli: any) => {
      // Agregamos 'T00:00:00' para evitar desfases de zona horaria al parsear
      const fechaEstreno = new Date(`${peli.fecha_estreno}T00:00:00`);
      
      // Diferencia en milisegundos convertida a días
      const diferenciaMs = fechaEstreno.getTime() - hoy.getTime();
      const diasParaEstreno = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

      return {
        ...peli,
        diasParaEstreno,
        // Habilitamos la preventa solo si faltan 7 días o menos
        habilitarPreventa: diasParaEstreno <= 7 && diasParaEstreno > 0
      };
    });

    this.peliculasEstreno.set(peliculasMapeadas);
  }

  comprarPreventa(peliId: string) {
    this.preventaSeleccionada.emit(peliId);
  }
}