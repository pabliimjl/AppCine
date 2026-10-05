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
  peliculaEditandoId = signal<string | null>(null);
  imagenSeleccionada: File | null = null;
  imagenActual: string | null = null;
  readonly mesesEstreno = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  readonly aniosEstreno = Array.from(
    { length: new Date().getFullYear() + 21 - 1900 },
    (_, index) => new Date().getFullYear() + 20 - index
  );

  peliculaForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    duracion: [120, [Validators.required, Validators.min(1)]],
    dia_estreno: [null, Validators.required],
    mes_estreno: [null, Validators.required],
    anio_estreno: [null, Validators.required],
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
    if (!this.fechaEstrenoValida()) {
      this.mensajeError.set('Selecciona un día, mes y año válidos para el estreno.');
      return;
    }

    if (this.peliculaForm.invalid || (!this.peliculaEditandoId() && !this.imagenSeleccionada)) {
      this.mensajeError.set('Completa los campos requeridos y selecciona un póster.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);

    let imagen = this.imagenActual;
    if (this.imagenSeleccionada) {
      try {
        imagen = await this.supabaseService.subirImagen(this.imagenSeleccionada, 'posters');
      } catch (error) {
        this.cargando.set(false);
        const detalle = error instanceof Error ? error.message : String(error);
        this.mensajeError.set(`Error al subir el póster: ${detalle}`);
        return;
      }
    }

    const { dia_estreno, mes_estreno, anio_estreno, ...formValues } = this.peliculaForm.value;
    const fecha_estreno = `${anio_estreno}-${String(mes_estreno).padStart(2, '0')}-${String(dia_estreno).padStart(2, '0')}`;

    const nuevaPelicula = {
      ...formValues,
      imagen,
      fecha_estreno,
      generos: formValues.generos.split(',').map((g: string) => g.trim()),
      formatos: formValues.formatos.split(',').map((f: string) => f.trim()),
      idiomas: formValues.idiomas.split(',').map((i: string) => i.trim()),
      restriccion_edad: formValues.restriccion_edad ? Number(formValues.restriccion_edad) : null
    };

    const { error } = this.peliculaEditandoId()
      ? await this.supabase.from('peliculas').update(nuevaPelicula).eq('id', this.peliculaEditandoId())
      : await this.supabase.from('peliculas').insert([nuevaPelicula]);

    this.cargando.set(false);

    if (error) {
      this.mensajeError.set('Error al guardar la película: ' + error.message);
    } else {
      this.mensajeExito.set(this.peliculaEditandoId()
        ? '¡Película actualizada correctamente!'
        : '¡Película agregada con éxito a la cartelera!');
      this.limpiarFormulario();
      await this.cargarPeliculas(); 
    }
  }

  editarPelicula(pelicula: any) {
    this.peliculaEditandoId.set(pelicula.id);
    this.imagenActual = pelicula.imagen;
    this.imagenSeleccionada = null;
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    const [anio, mes, dia] = (pelicula.fecha_estreno || '').slice(0, 10).split('-').map(Number);
    this.peliculaForm.patchValue({
      nombre: pelicula.nombre,
      sinopsis: pelicula.sinopsis,
      duracion: pelicula.duracion,
      dia_estreno: dia || null,
      mes_estreno: mes || null,
      anio_estreno: anio || null,
      precio_base: pelicula.precio_base,
      precio_preventa: pelicula.precio_preventa,
      restriccion_edad: pelicula.restriccion_edad,
      generos: Array.isArray(pelicula.generos) ? pelicula.generos.join(', ') : pelicula.generos,
      formatos: Array.isArray(pelicula.formatos) ? pelicula.formatos.join(', ') : pelicula.formatos,
      idiomas: Array.isArray(pelicula.idiomas) ? pelicula.idiomas.join(', ') : pelicula.idiomas
    });
  }

  async eliminarPelicula(pelicula: any) {
    if (!confirm(`¿Eliminar la película "${pelicula.nombre}"?`)) return;

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    const { error } = await this.supabase.from('peliculas').delete().eq('id', pelicula.id);
    this.cargando.set(false);

    if (error) {
      this.mensajeError.set('No se pudo eliminar la película: ' + error.message);
      return;
    }

    if (this.peliculaEditandoId() === pelicula.id) this.limpiarFormulario();
    this.mensajeExito.set('Película eliminada correctamente.');
    await this.cargarPeliculas();
  }

  cancelarEdicion() {
    this.limpiarFormulario();
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
  }

  private limpiarFormulario() {
    this.peliculaEditandoId.set(null);
    this.imagenActual = null;
    this.imagenSeleccionada = null;
    this.peliculaForm.reset({
      duracion: 120,
      dia_estreno: null,
      mes_estreno: null,
      anio_estreno: null,
      precio_base: 1500,
      precio_preventa: 1200,
      generos: 'Acción, Drama',
      formatos: '2D, 3D',
      idiomas: 'Español, Subtitulado'
    });
  }

  diasDisponibles(): number[] {
    const mes = Number(this.peliculaForm.get('mes_estreno')?.value);
    const anio = Number(this.peliculaForm.get('anio_estreno')?.value);
    if (!mes || !anio) {
      return Array.from({ length: 31 }, (_, index) => index + 1);
    }

    const totalDias = new Date(anio, mes, 0).getDate();
    return Array.from({ length: totalDias }, (_, index) => index + 1);
  }

  actualizarDiasFecha() {
    const diaControl = this.peliculaForm.get('dia_estreno');
    const dia = Number(diaControl?.value);
    if (dia && dia > this.diasDisponibles().length) {
      diaControl?.setValue(null);
    }
    this.mensajeError.set(null);
  }

  private fechaEstrenoValida(): boolean {
    const dia = Number(this.peliculaForm.get('dia_estreno')?.value);
    const mes = Number(this.peliculaForm.get('mes_estreno')?.value);
    const anio = Number(this.peliculaForm.get('anio_estreno')?.value);
    if (!dia || !mes || !anio) return false;

    const fecha = new Date(anio, mes - 1, dia);
    return fecha.getFullYear() === anio &&
      fecha.getMonth() === mes - 1 &&
      fecha.getDate() === dia;
  }

  seleccionarImagen(event: Event) {
    const input = event.target as HTMLInputElement;
    this.imagenSeleccionada = input.files?.[0] ?? null;
  }

  get supabase() {
    return (this.supabaseService as any).supabase;
  }
}