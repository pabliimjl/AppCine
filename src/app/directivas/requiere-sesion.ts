import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../servicios/supabase'; // <-- Cambiado aquí

@Directive({
  selector: '[requiereSesion]',
  standalone: true
})
export class RequiereSesion implements OnInit, OnDestroy {
  @Input('requiereSesionElse') plantillaAlternativa!: TemplateRef<any>;
  private suscripcionSesion!: Subscription;
  private estaLogeado: boolean = false;

  constructor(
    private plantillaPrincipal: TemplateRef<any>,
    private contenedorVista: ViewContainerRef,
    private supabase: SupabaseService // <-- Cambiado aquí
  ) {}

  ngOnInit() {
    this.suscripcionSesion = this.supabase.estadoUsuario$.subscribe(estado => {
      this.estaLogeado = estado.logeado;
      this.actualizarVista();
    });
  }

  private actualizarVista() {
    this.contenedorVista.clear();
    
    if (this.estaLogeado) {
      this.contenedorVista.createEmbeddedView(this.plantillaPrincipal);
    } else if (this.plantillaAlternativa) {
      this.contenedorVista.createEmbeddedView(this.plantillaAlternativa);
    }
  }

  ngOnDestroy() {
    if (this.suscripcionSesion) {
      this.suscripcionSesion.unsubscribe();
    }
  }
}