import { Component, OnInit, signal } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { SupabaseService } from './servicios/supabase'; 
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true, 
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'] 
})
export class App implements OnInit {
  
  listaPeliculas = signal<any[]>([]); 
  cargando = signal<boolean>(true); 

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
    const pelis = await this.supabaseService.obtenerPeliculas();
    
    this.listaPeliculas.set(pelis);
    this.cargando.set(false); 
    
    console.log('Mis películas con Signals:', this.listaPeliculas());
  }
}