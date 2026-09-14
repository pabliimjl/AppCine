import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-bienvenida-cine',
  standalone: true,
  imports: [RouterLink], 
  templateUrl: './bienvenida-cine.html',
  styleUrl: './bienvenida-cine.scss' 
})
export class BienvenidaCine {
}