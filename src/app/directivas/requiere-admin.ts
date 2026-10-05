import { Directive, OnDestroy, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../servicios/supabase';

@Directive({
  selector: '[requiereAdmin]',
  standalone: true
})
export class RequiereAdmin implements OnInit, OnDestroy {
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly supabase = inject(SupabaseService);
  private suscripcion?: Subscription;
  private visible = false;

  ngOnInit() {
    this.suscripcion = this.supabase.estadoUsuario$.subscribe(estado => {
      if (estado.esAdmin && !this.visible) {
        this.contenedor.createEmbeddedView(this.plantilla);
        this.visible = true;
      } else if (!estado.esAdmin && this.visible) {
        this.contenedor.clear();
        this.visible = false;
      }
    });
  }

  ngOnDestroy() {
    this.suscripcion?.unsubscribe();
  }
}