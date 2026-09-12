import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../servicios/supabase'; 
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule,CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'] // o .scss
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService); // <--- Cambiado aquí
  private router = inject(Router);

  cargando = signal(false);
  mensajeError = signal<string | null>(null);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  async iniciarSesion() {
    if (this.loginForm.invalid) {
      this.mensajeError.set('Por favor, completa los campos correctamente.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    const { email, password } = this.loginForm.value;

    try {
      // 1. Llamamos a tu método de login
      const { data, error } = await this.supabaseService.login(email!, password!);

      if (error) throw error;

      // 2. Obtenemos el perfil del usuario (tu método ya busca al usuario actual)
      const perfil = await this.supabaseService.obtenerPerfilUsuario();
      
      // 3. Evaluamos el rol (asegúrate de tener una columna 'rol' en tu tabla 'perfiles')
      if (perfil && perfil.rol === 'admin') {
        console.log('redirigiendo a admin');
        this.router.navigate(['../admin']); // Redirige al panel
        
      } else {
        console.log('redirigiendo a cartelera');
        this.router.navigate(['/cartelera']);   // Redirige a la app de clientes
        
      }
      
    } catch (err: any) {
      // Manejo de errores de Supabase
      this.mensajeError.set(err.message || 'Error al validar las credenciales. Revisa tu correo y contraseña.');
    } finally {
      this.cargando.set(false);
    }
  }
}