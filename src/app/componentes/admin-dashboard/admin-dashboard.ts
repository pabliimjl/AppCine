import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfiguracionDescuentos, SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboard implements OnInit {
  private supabaseService = inject(SupabaseService);
  private fb = inject(FormBuilder);

  totalPeliculas = signal<number>(0);
  totalProductos = signal<number>(0);
  totalCombos = signal<number>(0);
  totalFunciones = signal<number>(0);
  guardandoDescuentos = signal(false);
  mensajeDescuentos = signal<string | null>(null);

  descuentosForm = this.fb.group({
    primeraCompraActiva: [true],
    codigoPrimeraCompra: ['BIENVENIDA', Validators.required],
    descuentoPrimeraCompra: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    mayores50Activos: [false],
    edadMinima: [50, [Validators.required, Validators.min(1), Validators.max(120)]],
    descuentoMayores50: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    valorPuntoPesos: [1, [Validators.required, Validators.min(0.01), Validators.max(1000000)]]
  });

  async ngOnInit() {
    await Promise.all([this.cargarMetricas(), this.cargarConfiguracionDescuentos()]);
  }

  async cargarConfiguracionDescuentos() {
    const configuracion = await this.supabaseService.obtenerConfiguracionDescuentos();
    this.descuentosForm.patchValue(configuracion);
  }

  async guardarConfiguracionDescuentos() {
    if (this.descuentosForm.invalid) {
      this.descuentosForm.markAllAsTouched();
      return;
    }

    this.guardandoDescuentos.set(true);
    this.mensajeDescuentos.set(null);
    const configuracion = this.descuentosForm.getRawValue() as ConfiguracionDescuentos;
    const guardado = await this.supabaseService.guardarConfiguracionDescuentos(configuracion);
    this.mensajeDescuentos.set(guardado
      ? 'Configuración guardada.'
      : 'No se pudo guardar. Verifica la migración y los permisos de Supabase.');
    this.guardandoDescuentos.set(false);
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