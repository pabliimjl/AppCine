import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboard implements OnInit {
  private supabaseService = inject(SupabaseService);

  totalPeliculas = signal<number>(0);
  totalProductos = signal<number>(0);
  totalCombos = signal<number>(0);
  totalFunciones = signal<number>(0);

  async ngOnInit() {
    await this.cargarMetricas();
  }

  async cargarMetricas() {
    const supabase = (this.supabaseService as any).supabase;

    const [pelis, prods, combos, funciones] = await Promise.all([
      supabase.from('peliculas').select('*', { count: 'exact', head: true }),
      supabase.from('candy_productos').select('*', { count: 'exact', head: true }),
      supabase.from('candy_combos').select('*', { count: 'exact', head: true }),
      supabase.from('funciones').select('*', { count: 'exact', head: true })
    ]);

    if (pelis.count !== null) this.totalPeliculas.set(pelis.count);
    if (prods.count !== null) this.totalProductos.set(prods.count);
    if (combos.count !== null) this.totalCombos.set(combos.count);
    if (funciones.count !== null) this.totalFunciones.set(funciones.count);
  }
}