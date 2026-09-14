import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../servicios/supabase';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-funciones-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './funciones-admin.html',
  styleUrls: ['./funciones-admin.scss']
})

export class FuncionesAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);

  peliculas = signal<any[]>([]);
  salas = signal<any[]>([]);
  funciones = signal<any[]>([]);
  
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  cargando = signal<boolean>(false);

  funcionForm: FormGroup = this.fb.group({
    pelicula_id: ['', Validators.required],
    hora_inicio: ['18:00', Validators.required],
    fecha_inicio_recurrencia: ['', Validators.required],
    semanas_duracion: [4, [Validators.required, Validators.min(1)]],
    dias_semana: this.fb.group({
      0: [false], 
      1: [true],  
      2: [true],  
      3: [false], 
      4: [false], 
      5: [true],  
      6: [false]  
    })
  });

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    const supabase = (this.supabaseService as any).supabase;
    const [pelisRes, salasRes, funcRes] = await Promise.all([
      supabase.from('peliculas').select('*'),
      supabase.from('salas').select('*'),
      supabase.from('funciones').select('*, peliculas(nombre, duracion), salas(nombre)').order('fecha_hora_inicio', { ascending: true })
    ]);

    if (pelisRes.data) this.peliculas.set(pelisRes.data);
    if (salasRes.data) this.salas.set(salasRes.data);
    if (funcRes.data) this.funciones.set(funcRes.data);
  }

  async programarFuncionesRecurrentes() {
    if (this.funcionForm.invalid) {
      this.mensajeError.set('Por favor, completa todos los campos correctamente.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    const { pelicula_id, hora_inicio, fecha_inicio_recurrencia, semanas_duracion, dias_semana } = this.funcionForm.value;

    const pelicula = this.peliculas().find(p => p.id === pelicula_id);
    if (!pelicula) {
      this.cargando.set(false);
      return;
    }

    const duracionMinutos = pelicula.duracion || 120;
    const [horaStr, minStr] = hora_inicio.split(':');
    
    const fechasACrear: { inicio: Date; fin: Date }[] = [];
    const fechaBase = new Date(fecha_inicio_recurrencia + 'T00:00:00');
    
    const totalDias = semanas_duracion * 7;
    for (let i = 0; i < totalDias; i++) {
      const fechaActual = new Date(fechaBase);
      fechaActual.setDate(fechaBase.getDate() + i);
      
      const diaSemana = fechaActual.getDay(); 

      if (dias_semana[diaSemana]) {
        const inicio = new Date(fechaActual);
        inicio.setHours(Number(horaStr), Number(minStr), 0, 0);

        if (inicio.getTime() >= new Date().getTime()) {
          const fin = new Date(inicio.getTime() + (duracionMinutos + 30) * 60000);
          fechasACrear.push({ inicio, fin });
        }
      }
    }

    if (fechasACrear.length === 0) {
      this.cargando.set(false);
      this.mensajeError.set('No se generaron fechas válidas a partir de la fecha seleccionada.');
      return;
    }

    const supabase = (this.supabaseService as any).supabase;
    let funcionesExitosas = 0;
    let conflictos = 0;

    for (const cita of fechasACrear) {
      const salaAsignada = await this.encontrarSalaLibre(cita.inicio, cita.fin);

      if (salaAsignada) {
        const { error } = await supabase.from('funciones').insert([{
          pelicula_id,
          sala_id: salaAsignada.id,
          fecha_hora_inicio: cita.inicio.toISOString(),
          fecha_hora_fin: cita.fin.toISOString()
        }]);

        if (!error) funcionesExitosas++;
        else conflictos++;
      } else {
        conflictos++; 
      }
    }

    this.cargando.set(false);
    this.mensajeExito.set(`¡Proceso finalizado! Se programaron ${funcionesExitosas} funciones con éxito. (${conflictos} omitidas por superposición de sala).`);
    await this.cargarDatos();
  }

  async encontrarSalaLibre(nuevoInicio: Date, nuevoFin: Date) {
    const supabase = (this.supabaseService as any).supabase;
    const todasSalas = this.salas();
    if (!todasSalas || todasSalas.length === 0) return null;

    const tNuevoInicio = nuevoInicio.getTime();
    const tNuevoFin = nuevoFin.getTime();

    for (const sala of todasSalas) {
      const { data: funcionesSala } = await supabase
        .from('funciones')
        .select('fecha_hora_inicio, fecha_hora_fin')
        .eq('sala_id', sala.id);

      let haySuperposicion = false;

      if (funcionesSala && funcionesSala.length > 0) {
        for (const f of funcionesSala) {
          const tInicioExistente = new Date(f.fecha_hora_inicio).getTime();
          const tFinExistente = new Date(f.fecha_hora_fin).getTime();

          if (tNuevoInicio < tFinExistente && tNuevoFin > tInicioExistente) {
            haySuperposicion = true;
            break;
          }
        }
      }

      if (!haySuperposicion) {
        return sala; 
      }
    }

    return null; 
  }

  async eliminarFuncion(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta función de la cartelera?')) return;

    const supabase = (this.supabaseService as any).supabase;
    const { error } = await supabase.from('funciones').delete().eq('id', id);

    if (error) {
      this.mensajeError.set('Error al eliminar la función: ' + error.message);
    } else {
      this.mensajeExito.set('¡Función eliminada con éxito!');
      await this.cargarDatos(); 
    }
  }
  
}