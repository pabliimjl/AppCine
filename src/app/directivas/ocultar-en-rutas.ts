import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, Event } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Directive({
  selector: '[ocultarEnRutas]',
  standalone: true
})
export class OcultarEnRutas implements OnInit, OnDestroy {
  @Input('ocultarEnRutas') rutasExcluidas: string[] = [];
  private suscripcionNavegacion!: Subscription;

  constructor(
    private plantilla: TemplateRef<any>,
    private contenedorVista: ViewContainerRef,
    private enrutador: Router
  ) {}

  ngOnInit() {
    this.evaluarVisibilidad(this.enrutador.url);

    this.suscripcionNavegacion = this.enrutador.events.pipe(
      filter((evento: Event): evento is NavigationEnd => evento instanceof NavigationEnd)
    ).subscribe((evento: NavigationEnd) => {
      this.evaluarVisibilidad(evento.urlAfterRedirects);
    });
  }

  private evaluarVisibilidad(urlActual: string) {
    const urlSinParametros = urlActual.split('?')[0];

    if (this.rutasExcluidas.includes(urlSinParametros)) {
      this.contenedorVista.clear();
    } else {
      if (this.contenedorVista.length === 0) {
        this.contenedorVista.createEmbeddedView(this.plantilla);
      }
    }
  }

  ngOnDestroy() {
    if (this.suscripcionNavegacion) {
      this.suscripcionNavegacion.unsubscribe();
    }
  }
}