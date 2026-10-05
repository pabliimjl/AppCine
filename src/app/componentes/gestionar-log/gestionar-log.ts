import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-gestionar-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gestionar-log.html',
  styleUrls: ['./gestionar-log.scss']
})
export class GestionarLogComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);

  eventosAuditoria = signal<any[]>([]);
  periodoDias = signal(30);
  diasSeleccionados = 30;
  cargandoAuditoria = signal(false);
  errorAuditoria = signal<string | null>(null);

  async ngOnInit() {
    await this.cargarAuditoria();
  }

  async aplicarPeriodo() {
    const dias = Number(this.diasSeleccionados);
    if (!Number.isFinite(dias) || dias < 1 || dias > 3650) return;

    this.diasSeleccionados = Math.floor(dias);
    this.periodoDias.set(this.diasSeleccionados);
    await this.cargarAuditoria();
  }

  async cargarAuditoria() {
    this.cargandoAuditoria.set(true);
    this.errorAuditoria.set(null);
    try {
      this.eventosAuditoria.set(await this.supabaseService.obtenerAuditoriaAdministrador(this.periodoDias()));
    } catch {
      this.errorAuditoria.set('No se pudo cargar la auditoría. Verifica que la migración esté aplicada y que tu perfil tenga rol administrador.');
    } finally {
      this.cargandoAuditoria.set(false);
    }
  }
}