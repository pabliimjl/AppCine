import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  FormBuilder, 
  FormGroup, 
  ReactiveFormsModule, 
  Validators, 
  AbstractControl, 
  ValidationErrors, 
  ValidatorFn 
} from '@angular/forms';
import { SupabaseService } from '../../servicios/supabase';
import { Router } from '@angular/router';

// 1. Creamos el validador personalizado fuera de la clase
export const passwordsMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const repetirPassword = control.get('repetir_password');

  // Si los campos existen y sus valores son diferentes, retornamos un error
  if (password && repetirPassword && password.value !== repetirPassword.value) {
    // Establecemos el error en el control específico también para facilitar el manejo en la vista
    repetirPassword.setErrors({ ...repetirPassword.errors, passwordsMismatch: true });
    return { passwordsMismatch: true };
  } else {
    // Limpiamos el error específico si coinciden
    if (repetirPassword?.hasError('passwordsMismatch')) {
      delete repetirPassword.errors?.['passwordsMismatch'];
      if (!Object.keys(repetirPassword.errors || {}).length) {
        repetirPassword.setErrors(null);
      }
    }
    return null;
  }
};

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
  private router = inject(Router);

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  // 2. Agregamos el campo y el validador de grupo al formulario
  registroForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    repetir_password: ['', [Validators.required]], 
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    fecha_nacimiento: ['', Validators.required],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    dias_vacaciones: [0, [Validators.required, Validators.min(0)]]
  }, { validators: passwordsMatchValidator }); // <-- Aplicado a nivel de FormGroup

  async registrar() {
    if (this.registroForm.invalid) {
      this.mensajeError.set('Completa todos los campos correctamente. Verifica que las contraseñas coincidan.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    // 3. Excluimos 'repetir_password' de los datos que van a Supabase
    const { password, repetir_password, ...datosUsuario } = this.registroForm.value;
    
    const { error } = await this.supabaseService.registrarUsuario(datosUsuario, password);

    this.cargando.set(false);

    if (error) {
      this.mensajeError.set(error.message);
    } else {
      this.mensajeExito.set('¡Registro exitoso! Ya puedes iniciar sesión.');
      this.registroForm.reset();
      setTimeout(()=>{
        this.router.navigate(['/login'])
      },2000);
    }
  }
}