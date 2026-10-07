import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase';

interface Sala {
  id: string;
  nombre: string;
  capacidad: number;
}

@Component({
  selector: 'app-gestion-salas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './gestion-salas.html',
  styleUrls: ['./gestion-salas.scss']
})
export class GestionSalasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private supabase = (this.supabaseService as any).supabase;

  salas = signal<Sala[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  eliminandoId = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  salaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    capacidad: [518, [Validators.required, Validators.min(1), Validators.max(1000)]]
  });

  async ngOnInit() {
    await this.cargarSalas();
  }

  async cargarSalas() {
    this.cargando.set(true);
    const { data, error } = await this.supabase
      .from('salas')
      .select('id, nombre, capacidad')
      .order('nombre', { ascending: true });

    if (error) {
      this.mensajeError.set('No se pudieron cargar las salas.');
    } else {
      this.salas.set(data ?? []);
      this.mensajeError.set(null);
    }
    this.cargando.set(false);
  }

  async agregarSala() {
    if (this.salaForm.invalid || this.guardando()) {
      this.salaForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    const nombre = this.salaForm.controls.nombre.value?.trim();
    const capacidad = Number(this.salaForm.controls.capacidad.value);

    const { error } = await this.supabase
      .from('salas')
      .insert({ nombre, capacidad });

    if (error) {
      this.mensajeError.set(error.code === '23505'
        ? 'Ya existe una sala con ese nombre.'
        : 'No se pudo agregar la sala. Verifica los datos e inténtalo de nuevo.');
    } else {
      this.mensajeExito.set(`La sala ${nombre} se agregó correctamente.`);
      this.salaForm.reset({ nombre: '', capacidad: 50 });
      await this.cargarSalas();
    }
    this.guardando.set(false);
  }

  async quitarSala(sala: Sala) {
    if (this.eliminandoId()) return;
    if (!confirm(`¿Quieres quitar la sala "${sala.nombre}"?`)) return;

    this.eliminandoId.set(sala.id);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    const { error } = await this.supabase
      .from('salas')
      .delete()
      .eq('id', sala.id);

    if (error) {
      this.mensajeError.set(error.code === '23503'
        ? `No se puede quitar ${sala.nombre} porque tiene funciones asociadas.`
        : 'No se pudo quitar la sala. Inténtalo de nuevo.');
    } else {
      this.salas.update(salas => salas.filter(actual => actual.id !== sala.id));
      this.mensajeExito.set(`La sala ${sala.nombre} se quitó correctamente.`);
    }
    this.eliminandoId.set(null);
  }
}