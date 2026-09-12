import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-bienvenida-cine',
  standalone: true,
  imports: [RouterLink], // Importamos RouterLink para habilitar la navegación
  templateUrl: './bienvenida-cine.html',
  styleUrl: './bienvenida-cine.scss' // Nota: styleUrl en singular (nomenclatura moderna)
})
export class BienvenidaCine {
  // El componente queda limpio. La navegación se maneja en el template.
}