import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../servicios/supabase';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,RouterLink],
  templateUrl: './panel-admin.html',
  styleUrls: ['./panel-admin.scss']
})
export class AdminPanel implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);

  peliculas = signal<any[]>([]);
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  peliculaForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    imagen: ['', Validators.required],
    duracion: [120, [Validators.required, Validators.min(1)]],
    fecha_estreno: ['', Validators.required],
    precio_base: [1500, [Validators.required, Validators.min(0)]],
    precio_preventa: [1200, [Validators.required, Validators.min(0)]],
    restriccion_edad: [null], 
    generos: ['Acción, Drama', Validators.required], 
    formatos: ['2D, 3D', Validators.required],
    idiomas: ['Español, Subtitulado', Validators.required]
  });

  async ngOnInit() {
    await this.cargarPeliculas();
  }

  async cargarPeliculas() {
    const data = await this.supabaseService.obtenerPeliculas();
    this.peliculas.set(data);
  }

  async guardarPelicula() {
    if (this.peliculaForm.invalid) {
      this.mensajeError.set('Por favor, completa los campos requeridos.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    const formValues = this.peliculaForm.value;

    const nuevaPelicula = {
      ...formValues,
      generos: formValues.generos.split(',').map((g: string) => g.trim()),
      formatos: formValues.formatos.split(',').map((f: string) => f.trim()),
      idiomas: formValues.idiomas.split(',').map((i: string) => i.trim()),
      restriccion_edad: formValues.restriccion_edad ? Number(formValues.restriccion_edad) : null
    };

    const { error } = await this.supabase.from('peliculas').insert([nuevaPelicula]);

    this.cargando.set(false);

    if (error) {
      this.mensajeError.set('Error al guardar: ' + error.message);
    } else {
      this.mensajeExito.set('¡Película agregada con éxito a la cartelera!');
      this.peliculaForm.reset();
      await this.cargarPeliculas(); 
    }
  }

  get supabase() {
    return (this.supabaseService as any).supabase;
  }
}