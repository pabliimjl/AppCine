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

    const detallesReserva = this.detallesReserva();
    
    const destinatario = this.emailUsuario();
    const ticket = this.datosTicket();
    const pelicula = detallesReserva?.pelicula.nombre;
    const urlImagenPeli = detallesReserva?.pelicula.imagen;
    const fechaFuncion = new Date(detallesReserva?.fechaHoraFuncion );
    const fechaFormateada = fechaFuncion ? new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(fechaFuncion) : '';

    const horaFormateada = fechaFuncion ? new Intl.DateTimeFormat('es-AR',{
      hour:'2-digit',
      minute:'2-digit',
      hour12: false
    }).format(fechaFuncion) : '';
    
    
    

    try {
      // 1. Generamos el QR en Base64 asegurando un tamaño limpio
      const qrBase64DataUrl = await QRCode.toDataURL(this.nroReserva(), {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      const base64Puro = qrBase64DataUrl.split(',')[1];
      const urlImagenQR = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${this.nroReserva()}`;

      // 2. Construimos la sección de butacas de forma segura
      const htmlButacas = ticket?.butacas && ticket.butacas.length > 0
        ? ticket.butacas.map((b: any) => `<li style="margin-bottom: 6px; font-size: 14px;">🎟️ Fila <strong>${b.fila}</strong> - Asiento <strong>${b.numero}</strong> (${b.tipo})</li>`).join('')
        : '<li>Sin butacas registradas</li>';

      // 3. Construimos la sección de Candy Bar validando que existan ítems
      let htmlCandySeccion = '';
      if (ticket?.itemsCandy && ticket.itemsCandy.length > 0) {
        const listaCandy = ticket.itemsCandy.map((item: any) => 
          `<li style="margin-bottom: 6px; font-size: 14px;">🍿 <strong>${item.cantidad}x</strong> ${item.nombre}</li>`
        ).join('');

        htmlCandySeccion = `
          <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 25px; color: #333; font-size: 16px;">Candy Bar</h3>
          <ul style="list-style: none; padding-left: 0; margin: 10px 0;">
            ${listaCandy}
          </ul>
        `;
      }

      // 4. Estructura HTML optimizada para clientes de correo (usando tablas para máxima compatibilidad)
      const htmlBody = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #ddd; padding: 30px;">
                <tr>
                  <td align="center">
                    <h2 style="color: #e50914; margin-top: 0;">¡Gracias por tu compra!</h2>

                    <p style="color: #555; font-size: 15px;">Ya tenes tus entradas para ver ${pelicula}</p>
                      <img src="${urlImagenPeli}" alt="${pelicula}" width="180" style="display: block; margin: 0 auto;" />
                    <p style="color: #555; font-size: 15px;">Te esperamos el ${fechaFormateada} a las ${horaFormateada}</p>
                    <p style="color: #555; font-size: 15px;">Presenta este código QR en la entrada del cine y en el Candy Bar:</p>
                    
                    <!-- Contenedor del QR con dimensiones fijas para evitar distorsiones -->
                    <div style="margin: 20px 0; background: #ffffff; padding: 10px; display: inline-block; border: 1px solid #eee; border-radius: 8px;">
                      <img src="${urlImagenQR}" alt="Código QR de Reserva" width="180" height="180" style="display: block; margin: 0 auto;" />
                    </div>

                    <p style="font-size: 13px; color: #777; margin-bottom: 25px;">
                      Reserva oficial: <br>
                      <strong style="color: #333; font-family: monospace; font-size: 15px;">${this.nroReserva()}</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #333; font-size: 16px;">Tus Butacas</h3>
                    <ul style="list-style: none; padding-left: 0; margin: 10px 0;">
                      ${htmlButacas}
                    </ul>

                    ${htmlCandySeccion}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 30px;">
                    <p style="color: #888; font-size: 13px; margin: 0;">¡Disfruta la función! 🎬</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      // 5. Enviamos a Brevo adjuntando también el archivo por si el cliente bloquea imágenes
      /*const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json' 
        },
        body: JSON.stringify({
          sender: { name: 'Cine Scalas', email: 'pabloagustinjesus@gmail.com' },
          to: [ { email: destinatario } ],
          subject: 'Tus entradas para el cine 🎟️🍿',
          htmlContent: htmlBody,
          attachment: [
            {
              content: base64Puro,
              name: 'ticket-qr.png'
            }
          ]
        })
      });

      if (response.ok) {
        this.emailEnviado.set(true);
      } else {
        const errorData = await response.json();
        console.error('Error de Brevo:', errorData);
      }*/
    } catch (error) {
      console.error('Error en el proceso del correo:', error);
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
    
    const pelicula = detallesReserva?.pelicula.nombre || 'Película';
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