import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Pelicula {
  id: string;
  nombre: string;
  sinopsis: string;
  imagen: string;
  duracion: number;
  generos: string[];
  restriccion_edad: number | null;
  fecha_estreno: string;
  precio_base: number;
  precio_preventa: number;
  created_at?: string;
}

@Component({
  selector: 'app-tarjeta-pelicula',
  standalone: true,
  imports: [CommonModule], // Necesario para ngIf, ngFor y los pipes (Date, Currency)
  templateUrl: './tarjeta-pelicula.html',
  styleUrls: ['./tarjeta-pelicula.scss']
})
export class TarjetaPeliculaComponent {
  // El ! le dice a TypeScript que confíe en que este dato va a llegar
  @Input() pelicula!: Pelicula; 
}