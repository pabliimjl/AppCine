import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { QRCodeComponent, } from 'angularx-qrcode'; 
import { SupabaseService } from '../../servicios/supabase';
import * as QRCode from 'qrcode'; 
import { jsPDF } from 'jspdf'; 

@Component({
  selector: 'app-entrada',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  providers: [DatePipe],
  templateUrl: './entrada.html',
  styleUrls: ['./entrada.scss']
})
export class EntradaComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);

  nroReserva = signal<string>(''); 
  datosTicket = signal<any>(null);
  detallesReserva = signal<any>(null);
  esCompraAnonima = signal(false);
  emailUsuario = signal<string>('');
  emailEnviado = signal<boolean>(false);
  enviandoEmail = signal(false);
  errorEmail = signal<string | null>(null);

  constructor() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras.state) {
      this.datosTicket.set(nav.extras.state);
    }
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id || !this.datosTicket()) {
      this.router.navigate(['/cartelera']);
      return;
    }

    this.nroReserva.set(id);

    const [usuarioActual, detalles] = await Promise.all([
      this.supabaseService.obtenerUsuarioActual(),
      this.cargarDetallesReserva()
    ]);
    this.esCompraAnonima.set(!usuarioActual.data.user);
    this.detallesReserva.set(detalles);

    const { data } = usuarioActual;
    if (data?.user?.email) {
      this.emailUsuario.set(data.user.email);
      this.enviarTicketPorEmail();
    }
  }

  async enviarTicketPorEmail() {
    if (this.enviandoEmail() || this.emailEnviado()) return;

    this.enviandoEmail.set(true);
    this.errorEmail.set(null);
    try {
      const { error } = await this.supabaseService.enviarTicketPorEmail(this.nroReserva());
      if (error) throw error;
      this.emailEnviado.set(true);
    } catch (error) {
      console.error('Error al enviar el ticket:', error);
      this.errorEmail.set('No se pudo enviar el ticket. Puedes intentarlo nuevamente.');
    } finally {
      this.enviandoEmail.set(false);
    }
  }
  volverAlInicio() {
    this.router.navigate(['/cartelera']);
  }
  async cargarDetallesReserva(){
    return await this.supabaseService.obtenerDetallesReservaPorId(this.nroReserva())
  }

  async descargarPDF() {
    // 1. Instanciar el documento PDF (A4 por defecto)
    const doc = new jsPDF();
    
    // 2. Obtener datos
    const ticket = this.datosTicket();
    const detallesReserva = await this.cargarDetallesReserva();
    
    const pelicula = (detallesReserva?.pelicula.nombre || 'Película').toLocaleUpperCase('es-AR');
    const fechaFuncion = new Date(detallesReserva?.fechaHoraFuncion);
    
    const fechaFormateada = fechaFuncion ? new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(fechaFuncion) : '';
    
    const horaFormateada = fechaFuncion ? new Intl.DateTimeFormat('es-AR',{
      hour:'2-digit', minute:'2-digit', hour12: false
    }).format(fechaFuncion) : '';

    // 3. Generar Código QR en Base64 para el PDF
    const qrBase64DataUrl = await QRCode.toDataURL(this.nroReserva(), {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // --- DISEÑO DEL PDF ---
    
    // Título
    doc.setFontSize(22);
    doc.setTextColor(229, 9, 20); // Color rojo (estilo cine)
    doc.text('Cine Scalas - Tu Entrada', 20, 20);

    // Detalles de la Película
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`Película: ${pelicula}`, 20, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`Fecha: ${fechaFormateada} - Hora: ${horaFormateada}`, 20, 45);

    // Listado de Butacas
    let posicionY = 155;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);

    let posicionResumen = 128;
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    if (ticket?.importeDescuento > 0) {
      doc.text(`Descuento aplicado: -$${ticket.importeDescuento}`, 20, posicionResumen);
      posicionResumen += 7;
    }
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total pagado: $${ticket?.totalFinal ?? 0}`, 20, posicionResumen);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Tus Butacas:', 20, posicionY);
    
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    posicionY += 8;
    
    if (ticket?.butacas && ticket.butacas.length > 0) {
      ticket.butacas.forEach((b: any) => {
        doc.text(`Fila ${b.fila} - Asiento ${b.numero} (${b.tipo})`, 25, posicionY);
        posicionY += 7;
      });
    } else {
      doc.text('Sin butacas registradas', 25, posicionY);
      posicionY += 7;
    }

    // Listado de Candy Bar (si existe)
    if (ticket?.itemsCandy && ticket.itemsCandy.length > 0) {
      posicionY += 10;
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Candy Bar:', 20, posicionY);
      
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      posicionY += 8;
      
      ticket.itemsCandy.forEach((item: any) => {
        doc.text(`${item.cantidad}x ${item.nombre}`, 25, posicionY);
        posicionY += 7;
      });
    }

    // Incrustar el QR 
    // addImage(base64, formato, x, y, ancho, alto)
    doc.addImage(qrBase64DataUrl, 'PNG', 50, 60, 50, 50);
    
    // Texto del código de reserva debajo del QR
    doc.setFontSize(10);
    doc.text(`Reserva: ${this.nroReserva()}`, 20, 120);

    // 4. Descargar el archivo
    const nombreArchivo = `Entrada_${pelicula.replace(/\s+/g, '_')}_${this.nroReserva()}.pdf`;
    doc.save(nombreArchivo);
  }
}