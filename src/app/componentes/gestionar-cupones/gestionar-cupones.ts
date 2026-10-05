import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfiguracionDescuentos, SupabaseService } from '../../servicios/supabase';

@Component({
  selector: 'app-gestionar-cupones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './gestionar-cupones.html',
  styleUrls: ['./gestionar-cupones.scss']
})
export class GestionarCuponesComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly formBuilder = inject(FormBuilder);

  guardando = signal(false);
  mensaje = signal<string | null>(null);

  descuentosForm = this.formBuilder.group({
    primeraCompraActiva: [true],
    codigoPrimeraCompra: ['BIENVENIDA', Validators.required],
    descuentoPrimeraCompra: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    mayores50Activos: [false],
    edadMinima: [50, [Validators.required, Validators.min(1), Validators.max(120)]],
    descuentoMayores50: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    valorPuntoPesos: [1, [Validators.required, Validators.min(0.01), Validators.max(1000000)]]
  });

  async ngOnInit() {
    const configuracion = await this.supabaseService.obtenerConfiguracionDescuentos();
    this.descuentosForm.patchValue(configuracion);
  }

  async guardarConfiguracion() {
    if (this.descuentosForm.invalid) {
      this.descuentosForm.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.mensaje.set(null);
    const configuracion = this.descuentosForm.getRawValue() as ConfiguracionDescuentos;
    const guardado = await this.supabaseService.guardarConfiguracionDescuentos(configuracion);
    this.mensaje.set(guardado
      ? 'Configuración guardada.'
      : 'No se pudo guardar. Verifica la migración y los permisos de Supabase.');
    this.guardando.set(false);
  }
}