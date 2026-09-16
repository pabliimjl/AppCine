import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.scss']
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  registroForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]], //agregar repetir clave
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    fecha_nacimiento: ['', Validators.required],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    dias_vacaciones: [0, [Validators.required, Validators.min(0)]]
  });

  async registrar() {
    if (this.registroForm.invalid) {
      this.mensajeError.set('Completa todos los campos correctamente.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    const { password, ...datosUsuario } = this.registroForm.value;
    const { error } = await this.supabaseService.registrarUsuario(datosUsuario, password);

    this.cargando.set(false);

    if (error) {
      this.mensajeError.set(error.message);
    } else {
      this.mensajeExito.set('¡Registro exitoso! Ya puedes iniciar sesión.');
      this.registroForm.reset();
    }
  }
}