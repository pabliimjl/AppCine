import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
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
  metricasVentas = signal<any>(null);
  periodoPeliculas = signal<'semana' | 'mes'>('semana');
  cargandoMetricasVentas = signal(false);
  errorMetricasVentas = signal<string | null>(null);


  async ngOnInit() {
    await Promise.all([this.cargarMetricas(), this.cargarMetricasVentas()]);
  }

  async cambiarPeriodoPeliculas(periodo: 'semana' | 'mes') {
    this.periodoPeliculas.set(periodo);
    await this.cargarMetricasVentas();
  }

  async cargarMetricasVentas() {
    this.cargandoMetricasVentas.set(true);
    this.errorMetricasVentas.set(null);
    try {
      const datos = await this.supabaseService.obtenerMetricasAdministrador(this.periodoPeliculas());
      this.metricasVentas.set(datos);
    } catch {
      this.errorMetricasVentas.set('No se pudieron cargar las métricas. Verifica que la migración del dashboard esté aplicada.');
    } finally {
      this.cargandoMetricasVentas.set(false);
    }
  }

  alturaBarra(monto: number): number {
    const dias = this.metricasVentas()?.facturacion_diaria ?? [];
    const maximo = Math.max(...dias.map((dia: any) => Number(dia.monto)), 1);
    return monto > 0 ? Math.max(5, (monto / maximo) * 100) : 0;
  }

  exportarPdf() {
    const metricas = this.metricasVentas();
    if (!metricas) return;

    const documento = new jsPDF();
    const fechaReporte = new Date().toLocaleDateString('es-AR');
    const moneda = (monto: number) => new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(Number(monto));
    let posicionY = 20;

    documento.setFontSize(18);
    documento.text('Reporte de facturacion', 14, posicionY);
    posicionY += 9;
    documento.setFontSize(10);
    documento.text(`Generado: ${fechaReporte}`, 14, posicionY);
    posicionY += 12;
    documento.setFontSize(12);
    documento.text(`Facturacion de hoy: ${moneda(metricas.facturacion_hoy)}`, 14, posicionY);
    posicionY += 7;
    documento.text(`Entradas vendidas hoy: ${metricas.entradas_hoy}`, 14, posicionY);
    posicionY += 12;

    documento.setFontSize(13);
    documento.text('Facturacion diaria', 14, posicionY);
    posicionY += 8;
    documento.setFontSize(10);
    documento.text('Fecha', 14, posicionY);
    documento.text('Facturacion', 78, posicionY);
    documento.text('Entradas', 145, posicionY);
    posicionY += 6;
    metricas.facturacion_diaria.forEach((dia: any) => {
      const fecha = new Date(`${String(dia.fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR');
      documento.text(fecha, 14, posicionY);
      documento.text(moneda(dia.monto), 78, posicionY);
      documento.text(String(dia.entradas), 145, posicionY);
      posicionY += 6;
    });

    posicionY += 8;
    documento.setFontSize(13);
    documento.text(`Peliculas mas vistas (${this.periodoPeliculas()})`, 14, posicionY);
    posicionY += 8;
    documento.setFontSize(10);
    metricas.peliculas_mas_vistas.forEach((pelicula: any) => {
      documento.text(`${String(pelicula.nombre).toLocaleUpperCase('es-AR')} - ${pelicula.entradas} entradas`, 14, posicionY);
      posicionY += 6;
    });

    posicionY += 8;
    documento.setFontSize(13);
    documento.text('Productos mas solicitados', 14, posicionY);
    posicionY += 8;
    documento.setFontSize(10);
    metricas.productos_mas_solicitados.forEach((producto: any) => {
      documento.text(`${producto.nombre} (${producto.tipo}) - ${producto.cantidad} pedidos`, 14, posicionY);
      posicionY += 6;
    });

    documento.save(`reporte-facturacion-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  exportarExcel() {
    const metricas = this.metricasVentas();
    if (!metricas) return;

    const libro = XLSX.utils.book_new();
    const fechaReporte = new Date().toLocaleDateString('es-AR');
    const resumen = XLSX.utils.aoa_to_sheet([
      ['Reporte de facturacion'],
      ['Generado', fechaReporte],
      ['Facturacion de hoy (ARS)', Number(metricas.facturacion_hoy)],
      ['Entradas vendidas hoy', Number(metricas.entradas_hoy)],
      ['Periodo de peliculas', this.periodoPeliculas()]
    ]);
    const facturacionDiaria = XLSX.utils.json_to_sheet(metricas.facturacion_diaria.map((dia: any) => ({
      Fecha: String(dia.fecha).slice(0, 10),
      'Facturacion (ARS)': Number(dia.monto),
      Entradas: Number(dia.entradas)
    })));
    const peliculas = XLSX.utils.json_to_sheet(metricas.peliculas_mas_vistas.map((pelicula: any) => ({
      Pelicula: String(pelicula.nombre).toLocaleUpperCase('es-AR'),
      Entradas: Number(pelicula.entradas)
    })));
    const productos = XLSX.utils.json_to_sheet(metricas.productos_mas_solicitados.map((producto: any) => ({
      Producto: producto.nombre,
      Tipo: producto.tipo,
      Pedidos: Number(producto.cantidad)
    })));

    XLSX.utils.book_append_sheet(libro, resumen, 'Resumen');
    XLSX.utils.book_append_sheet(libro, facturacionDiaria, 'Facturacion diaria');
    XLSX.utils.book_append_sheet(libro, peliculas, 'Peliculas');
    XLSX.utils.book_append_sheet(libro, productos, 'Productos');
    XLSX.writeFile(libro, `reporte-facturacion-${new Date().toISOString().slice(0, 10)}.xlsx`);
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