import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs'; 

export interface ConfiguracionDescuentos {
  primeraCompraActiva: boolean;
  codigoPrimeraCompra: string;
  descuentoPrimeraCompra: number;
  mayores50Activos: boolean;
  edadMinima: number;
  descuentoMayores50: number;
  valorPuntoPesos: number;
}

export const CONFIGURACION_DESCUENTOS_POR_DEFECTO: ConfiguracionDescuentos = {
  primeraCompraActiva: true,
  codigoPrimeraCompra: 'BIENVENIDA',
  descuentoPrimeraCompra: 10,
  mayores50Activos: false,
  edadMinima: 50,
  descuentoMayores50: 20,
  valorPuntoPesos: 1
};

@Injectable({
  providedIn: 'root' 
})

export class SupabaseService {
  private supabase: SupabaseClient;

  private usuarioActual = new BehaviorSubject<{ logeado: boolean; nombre: string | null; esAdmin: boolean; rol: string | null }>({
    logeado: false,
    nombre: null,
    esAdmin: false,
    rol: null
  });
  public estadoUsuario$ = this.usuarioActual.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );

    this.verificarSesionInicial();
  }

  private async verificarSesionInicial() {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session && session.user) {
      const perfil = await this.obtenerPerfilUsuario();
      this.usuarioActual.next({ logeado: true, nombre: perfil?.nombre || 'Usuario', esAdmin: perfil?.rol === 'admin', rol: perfil?.rol ?? null });
    }
  }

  async cerrarSesion() {
    await this.supabase.auth.signOut();
    this.usuarioActual.next({ logeado: false, nombre: null, esAdmin: false, rol: null });
  }

  async obtenerPeliculas() {
    try {
      const { data, error } = await this.supabase
        .from('peliculas')
        .select('*')
        .order('fecha_estreno', { ascending: false });

      if (error) {
        console.error('Error al obtener las películas:', error.message);
        return []; 
      }

      return data;
    } catch (err) {
      console.error('Error inesperado de red:', err);
      return [];
    }
  }

  async login(email: string, password: string) {
    const respuesta = await this.supabase.auth.signInWithPassword({ email, password });
    
    // Si el login es exitoso, actualizamos el estado reactivo
    if (respuesta.data.session) {
      const perfil = await this.obtenerPerfilUsuario();
      this.usuarioActual.next({ logeado: true, nombre: perfil?.nombre || 'Usuario', esAdmin: perfil?.rol === 'admin', rol: perfil?.rol ?? null });
    }

    return respuesta;
  }

  async registrarUsuario(usuarioData: any, password: string) {
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: usuarioData.email,
      password,
    });

    if (authError) return { error: authError };

    if (authData.user) {
      const { error: dbError } = await this.supabase.from('perfiles').insert({
        id: authData.user.id,
        email: usuarioData.email,
        nombre: usuarioData.nombre,
        apellido: usuarioData.apellido,
        fecha_nacimiento: usuarioData.fecha_nacimiento,
        tipo_sangre: usuarioData.tipo_sangre,
        color_ojos: usuarioData.color_ojos,
        dias_vacaciones: usuarioData.dias_vacaciones
      });

      if (dbError) return { error: dbError };

      // Si el registro es exitoso y el perfil se creó, actualizamos el estado
      this.usuarioActual.next({ logeado: true, nombre: usuarioData.nombre, esAdmin: false, rol: 'usuario' });
    }

    return { data: authData, error: null };
  }

  async obtenerPerfilUsuario() {
    const { data: { user } } = await this.supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error al obtener perfil:', error.message);
      return null;
    }

    return data; 
  }

  async obtenerPerfilesParaGestionEmpleados() {
    const { data, error } = await this.supabase
      .from('perfiles')
      .select('id, email, nombre, apellido, rol')
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data;
  }

  async actualizarRolPerfil(id: string, rol: 'usuario' | 'empleado') {
    const { data, error } = await this.supabase
      .from('perfiles')
      .update({ rol })
      .eq('id', id)
      .select('id, rol')
      .single();

    if (error) throw error;
    return data;
  }

  async actualizarPerfilUsuario(datosPerfil: {
    nombre: string;
    apellido: string;
    fecha_nacimiento: string;
    tipo_sangre: string;
    color_ojos: string;
    dias_vacaciones: number;
  }) {
    const { data: { user }, error: errorUsuario } = await this.supabase.auth.getUser();
    if (errorUsuario || !user) {
      return { data: null, error: errorUsuario ?? new Error('Debes iniciar sesión para actualizar tu perfil.') };
    }

    const respuesta = await this.supabase.rpc('actualizar_perfil_usuario', {
      p_nombre: datosPerfil.nombre,
      p_apellido: datosPerfil.apellido,
      p_fecha_nacimiento: datosPerfil.fecha_nacimiento,
      p_tipo_sangre: datosPerfil.tipo_sangre,
      p_color_ojos: datosPerfil.color_ojos,
      p_dias_vacaciones: datosPerfil.dias_vacaciones
    });

    if (!respuesta.error) {
      this.usuarioActual.next({ ...this.usuarioActual.value, nombre: datosPerfil.nombre });
    }
    return respuesta;
  }

  async confirmarContrasenaActual(contrasena: string) {
    const { data: { user }, error: errorUsuario } = await this.supabase.auth.getUser();
    if (errorUsuario || !user?.email) {
      return { error: errorUsuario ?? new Error('No hay una sesión activa.') };
    }

    const { error } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: contrasena
    });
    return { error };
  }

  async cambiarContrasena(contrasena: string) {
    return await this.supabase.auth.updateUser({ password: contrasena });
  }

  async obtenerComprasUsuario() {
    const { data: { user }, error: errorUsuario } = await this.supabase.auth.getUser();
    if (errorUsuario || !user) return [];

    const { data, error } = await this.supabase
      .from('reservas')
      .select(`
        id,
        total,
        metodo_pago,
        creada_en,
        cancelada_en,
        entradas_compradas,
        entradas_retiradas,
        candy_retirado,
        funciones (
          fecha_hora_inicio,
          peliculas ( id, nombre, imagen, generos )
        ),
        reserva_asientos ( butaca_id, tipo )
      `)
      .eq('usuario_id', user.id)
      .order('creada_en', { ascending: false });

    if (error) {
      console.error('Error al cargar las compras del usuario:', error.message);
      return [];
    }

    return (data || []).map((compra: any) => {
      const funcion = Array.isArray(compra.funciones) ? compra.funciones[0] : compra.funciones;
      const pelicula = Array.isArray(funcion?.peliculas) ? funcion.peliculas[0] : funcion?.peliculas;
      return { ...compra, fecha_hora_inicio: funcion?.fecha_hora_inicio, pelicula };
    });
  }

  async obtenerMovimientosCreditos() {
    const { data: { user }, error: errorUsuario } = await this.supabase.auth.getUser();
    if (errorUsuario || !user) return [];

    const { data, error } = await this.supabase
      .from('movimientos_creditos')
      .select('id, reserva_id, tipo, importe, creado_en')
      .eq('usuario_id', user.id)
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al cargar los movimientos de créditos:', error.message);
      return [];
    }
    return data || [];
  }

  async obtenerMovimientosPuntos() {
    const { data: { user }, error: errorUsuario } = await this.supabase.auth.getUser();
    if (errorUsuario || !user) return [];

    const { data, error } = await this.supabase
      .from('movimientos_puntos')
      .select('id, reserva_id, tipo, puntos, creditos_generados, creado_en')
      .eq('usuario_id', user.id)
      .order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al cargar los movimientos de puntos:', error.message);
      return [];
    }
    return data || [];
  }

  async obtenerMetricasAdministrador(periodo: 'semana' | 'mes') {
    const { data, error } = await this.supabase.rpc('obtener_metricas_administrador', {
      p_periodo: periodo
    });

    if (error) {
      console.error('Error al cargar las métricas del administrador:', error.message);
      throw error;
    }

    return data;
  }

  async obtenerAuditoriaAdministrador(dias = 30) {
    const fechaDesde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const tamanoPagina = 100;
    const eventos: any[] = [];

    for (let desde = 0; ; desde += tamanoPagina) {
      const { data, error } = await this.supabase
        .from('log_auditoria')
        .select('id, ocurrido_en, usuario_nombre, accion, entidad, descripcion')
        .gte('ocurrido_en', fechaDesde)
        .order('ocurrido_en', { ascending: false })
        .range(desde, desde + tamanoPagina - 1);

      if (error) {
        console.error('Error al cargar el registro de auditoría:', error.message);
        throw error;
      }

      eventos.push(...(data || []));
      if (!data || data.length < tamanoPagina) break;
    }

    return eventos;
  }

  async canjearPuntosPorCreditos(puntos: number) {
    return await this.supabase.rpc('canjear_puntos_por_creditos', {
      p_puntos: puntos
    });
  }

  async obtenerResenasUsuario() {
    const { data: { user }, error: errorUsuario } = await this.supabase.auth.getUser();
    if (errorUsuario || !user) return [];

    const { data, error } = await this.supabase
      .from('resenas_peliculas')
      .select('id, pelicula_id, puntuacion, comentario, creada_en, actualizada_en')
      .eq('usuario_id', user.id);

    if (error) {
      console.error('Error al cargar las reseñas del usuario:', error.message);
      return [];
    }
    return data || [];
  }

  async cancelarCompraPorCreditos(reservaId: string) {
    return await this.supabase.rpc('cancelar_compra_por_creditos', {
      p_reserva_id: reservaId
    });
  }

  async guardarResenaPelicula(peliculaId: string, puntuacion: number, comentario: string) {
    return await this.supabase.rpc('guardar_resena_pelicula', {
      p_pelicula_id: peliculaId,
      p_puntuacion: puntuacion,
      p_comentario: comentario
    });
  }


  
  async obtenerConteoGenerosFunciones(): Promise<Record<string, number>> {
      try {
        const { data, error } = await this.supabase
          .rpc('obtener_conteo_generos_funciones');

        if (error) {
          console.error('Error al obtener el conteo de géneros:', error.message);
          return {}; 
        }

        return data as Record<string, number>;
      } catch (err) {
        console.error('Error inesperado de red al llamar RPC:', err);
        return {};
      }
    }
    
  async obtenerDetalleFuncion(funcionId: string) {
      const { data, error } = await this.supabase
        .from('funciones')
        .select(`
          id,
          fecha_hora_inicio,
          peliculas ( id, nombre, imagen, sinopsis, fecha_estreno, precio_base, precio_preventa, restriccion_edad ),
          salas ( id, nombre, capacidad )
        `)
        .eq('id', funcionId)
        .single();

      if (error) {
        console.error('Error al obtener detalle de la función:', error);
        return null;
      }
      const pelicula = Array.isArray(data.peliculas) ? data.peliculas[0] : data.peliculas;
      if (!pelicula) return data;

      const { data: calificacion, error: errorCalificacion } = await this.supabase.rpc(
        'obtener_calificacion_pelicula',
        { p_pelicula_id: pelicula.id }
      );
      if (errorCalificacion) {
        console.error('Error al obtener la calificación de la película:', errorCalificacion.message);
      }

      return {
        ...data,
        peliculas: {
          ...pelicula,
          calificacion_promedio: Number(calificacion?.promedio ?? 0),
          cantidad_resenas: Number(calificacion?.cantidad ?? 0)
        }
      };
    }
    
  async obtenerMenuCandy() {
    try {
      const [productosRes, combosRes] = await Promise.all([
        // Traemos productos y opcionalmente el nombre de su categoría
        this.supabase
          .from('candy_productos')
          .select(`*, candy_categorias(nombre)`)
          .gt('stock', 0), 
        
        // Traemos los combos
        this.supabase
          .from('candy_combos')
          .select('*')
      ]);

      return {
        productos: productosRes.data || [],
        combos: combosRes.data || []
      };
    } catch (error) {
      console.error('Error al obtener el Candy Bar:', error);
      return { productos: [], combos: [] };
    }
  }
  
  obtenerSesionId(): string {
    let sessionId = localStorage.getItem('reserva_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('reserva_session_id', sessionId);
    }
    return sessionId;
  }

  async obtenerConfiguracionDescuentos(): Promise<ConfiguracionDescuentos> {
    const { data, error } = await this.supabase
      .from('configuracion_descuentos')
      .select('*')
      .eq('id', true)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error al obtener la configuración de descuentos:', error.message);
      return CONFIGURACION_DESCUENTOS_POR_DEFECTO;
    }

    return {
      primeraCompraActiva: data.primera_compra_activa,
      codigoPrimeraCompra: data.codigo_primera_compra,
      descuentoPrimeraCompra: Number(data.descuento_primera_compra),
      mayores50Activos: data.mayores_50_activo,
      edadMinima: data.edad_minima,
      descuentoMayores50: Number(data.descuento_mayores_50),
      valorPuntoPesos: Number(data.valor_punto_pesos ?? 1)
    };
  }

  async guardarConfiguracionDescuentos(configuracion: ConfiguracionDescuentos): Promise<boolean> {
    const { error } = await this.supabase
      .from('configuracion_descuentos')
      .upsert({
        id: true,
        primera_compra_activa: configuracion.primeraCompraActiva,
        codigo_primera_compra: configuracion.codigoPrimeraCompra.trim().toUpperCase(),
        descuento_primera_compra: configuracion.descuentoPrimeraCompra,
        mayores_50_activo: configuracion.mayores50Activos,
        edad_minima: configuracion.edadMinima,
        descuento_mayores_50: configuracion.descuentoMayores50,
        valor_punto_pesos: configuracion.valorPuntoPesos,
        actualizado_en: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) console.error('Error al guardar la configuración de descuentos:', error.message);
    return !error;
  }

  async esPrimeraCompra(sesionId: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('es_primera_compra', {
      p_sesion_id: sesionId
    });
    if (error) {
      console.error('Error al comprobar compras anteriores:', error.message);
      return false;
    }
    return data === true;
  }

  async obtenerButacasOcupadas(funcionId: string) {
    // 1. Traemos las bloqueadas temporalmente
    const { data: bloqueadas } = await this.supabase
      .from('butacas_bloqueadas')
      .select('butaca_id, sesion_id')
      .gt('expira_en', new Date().toISOString()) 
      .eq('funcion_id', funcionId);
      
    // 2. Traemos las compradas definitivamente
    const { data: compradas } = await this.supabase
      .from('reserva_asientos')
      .select('butaca_id, reservas!inner(funcion_id, cancelada_en)')
      .eq('reservas.funcion_id', funcionId)
      .is('reservas.cancelada_en', null);

    // Unimos ambas listas. Las definitivas las marcamos con una sesión "comprada" 
    // para que el mapa las bloquee y nadie (ni el mismo usuario) pueda elegirlas.
    const ocupadasDefinitivas = (compradas || []).map(c => ({
      butaca_id: c.butaca_id,
      sesion_id: 'COMPRADA'
    }));

    return [...(bloqueadas || []), ...ocupadasDefinitivas];
  }

  async intentarBloquearButaca(funcionId: string, butacaId: string, sesionId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('bloquear_butaca', {
        p_funcion_id: funcionId,
        p_butaca_id: butacaId,
        p_sesion_id: sesionId
      });
      
    if (error) console.error(error);
    return data as boolean;
  }

  async liberarButaca(funcionId: string, butacaId: string, sesionId: string) {
    await this.supabase
      .from('butacas_bloqueadas')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('butaca_id', butacaId)
      .eq('sesion_id', sesionId);
  }

  async liberarButacasDeSesion(funcionId: string, sesionId: string) {
    await this.supabase
      .from('butacas_bloqueadas')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('sesion_id', sesionId);
  }

  // Escuchar cambios en tiempo real para actualizar la pantalla a otros usuarios
  suscribirseCambiosButacas(funcionId: string, callback: () => void) {
    return this.supabase
      .channel('cambios-butacas')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'butacas_bloqueadas',
        filter: `funcion_id=eq.${funcionId}`
      }, callback)
      .subscribe();
  }

  // ... (tus otros métodos)

  async guardarCompraDefinitiva(
    funcionId: string, 
    total: number, 
    metodoPago: string, 
    butacas: any[], 
    itemsCandy: any[], 
    sesionId: string,
    descuentoAplicado: { importe: number; tipo: string | null; codigoCupon: string | null } = {
      importe: 0,
      tipo: null,
      codigoCupon: null
    }
  ) {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();

      // 1. Creamos la reserva principal
      const { data: reserva, error: errReserva } = await this.supabase
        .from('reservas')
        .insert({ 
          funcion_id: funcionId, 
          total: total, 
          metodo_pago: metodoPago,
          entradas_compradas: butacas.length,
          usuario_id: user?.id ?? null,
          sesion_id: sesionId,
          descuento: descuentoAplicado.importe,
          tipo_descuento: descuentoAplicado.tipo,
          codigo_cupon: descuentoAplicado.codigoCupon
        })
        .select('id')
        .single();

      if (errReserva) throw errReserva;

      // 2. Insertamos las butacas compradas
      const butacasInsert = butacas.map(b => ({
        reserva_id: reserva.id,
        butaca_id: b.id,
        tipo: b.tipo
      }));
      
      const { error: errButacas } = await this.supabase
        .from('reserva_asientos')
        .insert(butacasInsert);

      if (errButacas) throw errButacas;

      // 3. Insertamos los productos del Candy Bar (si compró algo)
      if (itemsCandy && itemsCandy.length > 0) {
        const candyInsert = itemsCandy.map(c => ({
          reserva_id: reserva.id,
          item_id: c.id,
          tipo_item: c.tipo,
          cantidad: c.cantidad,
          precio: c.precio
        }));

        const { error: errCandy } = await this.supabase
          .from('reserva_candy')
          .insert(candyInsert);

        if (errCandy) throw errCandy;
      }

      // 4. Limpiamos las butacas bloqueadas temporalmente de este usuario
      await this.supabase
        .from('butacas_bloqueadas')
        .delete()
        .eq('sesion_id', sesionId);

      return reserva.id; // Retornamos el ID oficial de la compra para el ticket final

    } catch (error) {
      console.error('Error al guardar la compra en BD:', error);
      return null;
    }
  }

  async guardarCompraConCreditos(
    funcionId: string,
    totalEsperado: number,
    butacas: any[],
    itemsCandy: any[],
    sesionId: string,
    codigoCupon: string | null,
    fechaNacimiento: string | null,
    creditosUsados: number = totalEsperado,
    metodoExterno: 'mp' | 'tarjeta' | null = null
  ): Promise<{ reservaId: string | null; saldoCreditos: number | null; error: string | null }> {
    const { data, error } = await this.supabase.rpc('comprar_con_creditos', {
      p_funcion_id: funcionId,
      p_sesion_id: sesionId,
      p_butacas: butacas.map(butaca => ({ id: butaca.id, tipo: butaca.tipo })),
      p_items_candy: itemsCandy.map(item => ({ id: item.id, tipo: item.tipo, cantidad: item.cantidad })),
      p_total_esperado: totalEsperado,
      p_codigo_cupon: codigoCupon,
      p_fecha_nacimiento: fechaNacimiento || null,
      p_creditos_usados: creditosUsados,
      p_metodo_externo: metodoExterno
    });

    if (error) {
      return { reservaId: null, saldoCreditos: null, error: error.message };
    }

    const resultado = data as { reserva_id: string; saldo_creditos: number };
    return {
      reservaId: resultado.reserva_id,
      saldoCreditos: Number(resultado.saldo_creditos),
      error: null
    };
  }

  async obtenerUsuarioActual(){
    return await this.supabase.auth.getUser();
  }

  async enviarTicketPorEmail(reservaId: string) {
    return await this.supabase.functions.invoke('send-ticket-email', {
      body: { reservaId }
    });
  }

  async obtenerPeliculasEnCartelera() {
    const hoy = new Date().toISOString();

    try {
      // 1. Traemos las funciones vigentes
      const { data: funciones, error: errFunciones } = await this.supabase
        .from('funciones')
        .select(`
          id,
          fecha_hora_inicio,
          peliculas (
            id,
            nombre,
            imagen,
            fecha_estreno,
            generos
          )
        `)
        .gte('fecha_hora_inicio', hoy);

      if (errFunciones) throw errFunciones;
      if (!funciones || funciones.length === 0) return [];

      // Forzamos el tipado para evitar que TypeScript trate 'peliculas' como un array
      const funcionesMapeadas = funciones.map((f: any) => ({
        id: f.id,
        fecha_hora_inicio: f.fecha_hora_inicio,
        peliculas: Array.isArray(f.peliculas) ? f.peliculas[0] : f.peliculas
      }));

      const funcionIds = funcionesMapeadas.map(f => f.id);

      // 2. Consultamos las reservas y asientos vendidos
      const { data: reservas, error: errReservas } = await this.supabase
        .from('reservas')
        .select(`
          funcion_id,
          reserva_asientos ( id )
        `)
        .in('funcion_id', funcionIds)
        .is('cancelada_en', null);

      if (errReservas) throw errReservas;

      // 3. Sumamos cuántas butacas se vendieron por cada película
      const ventasPorPelicula: { [key: string]: number } = {};
      
      if (reservas) {
        reservas.forEach((res: any) => {
          const funcEncontrada = funcionesMapeadas.find(f => f.id === res.funcion_id);
          const peliId = funcEncontrada?.peliculas?.id;
          const cantAsientos = res.reserva_asientos ? res.reserva_asientos.length : 0;

          if (peliId) {
            ventasPorPelicula[peliId] = (ventasPorPelicula[peliId] || 0) + cantAsientos;
          }
        });
      }

      // 4. Ordenamos las funciones por ventas y luego por fecha cronológica
      const funcionesOrdenadas = funcionesMapeadas.sort((a, b) => {
        const peliIdA = a.peliculas?.id;
        const peliIdB = b.peliculas?.id;

        const ventasA = ventasPorPelicula[peliIdA] || 0;
        const ventasB = ventasPorPelicula[peliIdB] || 0;

        if (ventasB !== ventasA) {
          return ventasB - ventasA; // Mayor venta primero
        }

        return new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime();
      });
      
      return funcionesOrdenadas;

    } catch (error) {
      console.error('Error al obtener cartelera ordenada por ventas:', error);
      return [];
    }
  }

 async obtenerDetallesReservaPorId(reservaId: string) {
    try {
      // 1. Buscamos la reserva principal (igual que antes)
      const { data, error } = await this.supabase
        .from('reservas')
        .select(`
          id,
          total,
          metodo_pago,
          creada_en,
          cancelada_en,
          entradas_compradas,
          entradas_retiradas,
          candy_retirado,
          funciones (
            id,
            fecha_hora_inicio,
            peliculas (
              id,
              nombre,
              imagen,
              fecha_estreno,
              generos,
              restriccion_edad
            )
          ),
          reserva_asientos (
            butaca_id,
            tipo
          ),
          reserva_candy (
            cantidad,
            precio,
            item_id,
            tipo_item
          )
        `)
        .eq('id', reservaId)
        .single(); 

      if (error) throw error;
      if (!data) return null;

      const butacasObtenidas = (data as any).reserva_asientos || [];
      const candyCrudo = (data as any).reserva_candy || [];

      // 2. Buscamos los detalles reales de cada item del Candy Bar
      const candyObtenido = await Promise.all(candyCrudo.map(async (c: any) => {
        let nombreReal = c.tipo_item || `Item (ID: ${c.item_id})`;
        let descripcionDetallada = '';

        if (c.tipo_item === 'combo') {
          // Si es un combo, buscamos en candy_combos
          const { data: comboData } = await this.supabase
            .from('candy_combos')
            .select('nombre, descripcion')
            .eq('id', c.item_id)
            .single();
            
          if (comboData) {
            nombreReal = comboData.nombre;
            descripcionDetallada = comboData.descripcion;
          }
        } else {
          // Si es un producto individual, buscamos en candy_productos
          const { data: productoData } = await this.supabase
            .from('candy_productos')
            .select('nombre')
            .eq('id', c.item_id)
            .single();
            
          if (productoData) {
            nombreReal = productoData.nombre;
          }
        }

        return {
          cantidad: c.cantidad,
          nombre: nombreReal,
          descripcion: descripcionDetallada, // Pasamos la descripción al frontend
          precio: c.precio
        };
      }));

      // 3. Retornamos toda la información al verificador
      return {
        id: (data as any).id,
        reservaId: (data as any).id,
        total: (data as any).total,
        metodoPago: (data as any).metodo_pago,
        creada_en: (data as any).creada_en,
        canceladaEn: (data as any).cancelada_en,
        entradas_retiradas: (data as any).entradas_retiradas || false,
        candy_retirado: (data as any).candy_retirado || false,
        butacas: butacasObtenidas, 
        itemsCandy: candyObtenido,
        fechaHoraFuncion: ((data as any).funciones as any)?.fecha_hora_inicio,
        pelicula: ((data as any).funciones as any)?.peliculas
      };

    } catch (error) {
      console.error('Error al obtener detalles de la reserva:', error);
      return null;
    }
  }

  async peliculasAEstrenar() {
    // Tomamos la fecha de hoy en formato YYYY-MM-DD
    const hoy = new Date().toISOString().split('T')[0];

    try {
      const { data, error } = await this.supabase
        .from('peliculas')
        .select(`
          id,
          nombre,
          imagen,
          generos,
          fecha_estreno
        `)
        .gt('fecha_estreno', hoy) // Estrictamente mayor a hoy (futuro)
        .order('fecha_estreno', { ascending: true }); // Las más cercanas primero

      if (error) throw error;
      return data || [];


    } catch (error) {
      console.error('Error al obtener próximos estrenos:', error);
      return [];
    }
  }

  async actualizarEstadoEntrega(idReserva: string, campo: 'entradas_retiradas' | 'candy_retirado', estado: boolean) {
    if (!estado) throw new Error('No se puede revertir una entrega.');

    const { data, error } = await this.supabase.rpc('marcar_entrega_reserva', {
      p_reserva_id: idReserva,
      p_campo: campo
    });

    if (error) throw error;
    if (!data) throw new Error('La reserva ya fue entregada, está cancelada o no existe.');
    return data;
  }
  
  async subirImagen(file: File, carpeta: 'posters' | 'candy' | 'combos'): Promise<string> {
    try {
      // 1. Generar un nombre único para la imagen (evita que se sobreescriban si se llaman igual)
      const extension = file.name.split('.').pop();
      const nombreUnico = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;
      const ruta = `${carpeta}/${nombreUnico}`; // Ej: posters/1698765432_x7yf9.jpg

      // 2. Subir el archivo al bucket llamado 'imagenes'
      const { data, error } = await this.supabase
        .storage
        .from('imagenes') // El nombre del bucket que creaste en el Paso 1
        .upload(ruta, file, {
          cacheControl: '3600',
          upsert: false // No sobreescribir
        });

      if (error) throw error;

      // 3. Obtener la URL pública para guardarla en la base de datos
      const { data: publicUrlData } = this.supabase
        .storage
        .from('imagenes')
        .getPublicUrl(ruta);

      return publicUrlData.publicUrl;

    } catch (error) {
      console.error('Error subiendo imagen a Supabase:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        throw new Error(String(error.message));
      }
      throw new Error('Error desconocido al subir la imagen.');
    }
  }
}