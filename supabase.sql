-- AppCine: esquema unificado para una instancia nueva de Supabase.
-- Ejecutar una vez desde Supabase SQL Editor en el proyecto de destino.
-- Requiere los esquemas administrados auth y storage de Supabase.
-- La Edge Function send-ticket-email se despliega por separado con Supabase CLI.
-- Este archivo concentra el esquema final; las migraciones de supabase/migrations
-- se conservan como historial evolutivo del proyecto.

begin;

grant usage on schema public to anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tablas base
-- -----------------------------------------------------------------------------

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text not null,
  apellido text not null,
  fecha_nacimiento date not null,
  tipo_sangre text not null,
  color_ojos text not null,
  dias_vacaciones integer not null default 0 check (dias_vacaciones between 0 and 365),
  rol text not null default 'usuario' check (rol in ('usuario', 'admin')),
  creditos numeric(12, 2) not null default 0 check (creditos >= 0),
  puntos numeric(14, 2) not null default 0 check (puntos >= 0)
);

create table if not exists public.peliculas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  sinopsis text not null,
  duracion integer not null check (duracion > 0),
  fecha_estreno date not null,
  precio_base numeric(12, 2) not null check (precio_base >= 0),
  precio_preventa numeric(12, 2) check (precio_preventa is null or precio_preventa >= 0),
  restriccion_edad integer,
  generos text[] not null default '{}',
  formatos text[] not null default '{}',
  idiomas text[] not null default '{}',
  imagen text
);

create table if not exists public.salas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  capacidad integer not null check (capacidad > 0)
);

create table if not exists public.funciones (
  id uuid primary key default gen_random_uuid(),
  pelicula_id uuid not null references public.peliculas(id) on delete restrict,
  sala_id uuid not null references public.salas(id) on delete restrict,
  fecha_hora_inicio timestamptz not null,
  fecha_hora_fin timestamptz not null,
  check (fecha_hora_fin > fecha_hora_inicio)
);

create index if not exists funciones_fecha_hora_inicio_idx on public.funciones(fecha_hora_inicio);
create index if not exists funciones_pelicula_id_idx on public.funciones(pelicula_id);
create index if not exists funciones_sala_id_idx on public.funciones(sala_id);

create table if not exists public.candy_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);

create table if not exists public.candy_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(12, 2) not null check (precio >= 0),
  categoria_id uuid not null references public.candy_categorias(id) on delete restrict,
  stock integer not null default 0 check (stock >= 0),
  imagen text
);

create table if not exists public.candy_combos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null,
  precio_combo numeric(12, 2) not null check (precio_combo >= 0),
  imagen text
);

create table if not exists public.candy_combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.candy_combos(id) on delete cascade,
  producto_id uuid not null references public.candy_productos(id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  unique (combo_id, producto_id)
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  funcion_id uuid not null references public.funciones(id) on delete restrict,
  total numeric(12, 2) not null check (total >= 0),
  metodo_pago text not null,
  usuario_id uuid references auth.users(id) on delete set null,
  sesion_id uuid,
  descuento numeric(10, 2) not null default 0 check (descuento >= 0),
  tipo_descuento text,
  codigo_cupon text,
  creada_en timestamptz not null default now(),
  cancelada_en timestamptz,
  entradas_compradas integer not null default 0 check (entradas_compradas >= 0),
  entradas_retiradas boolean not null default false,
  candy_retirado boolean not null default false,
  metodo_pago_secundario text,
  creditos_usados numeric(12, 2) not null default 0 check (creditos_usados >= 0),
  importe_externo numeric(12, 2) not null default 0 check (importe_externo >= 0),
  puntos_ganados numeric(14, 2) not null default 0 check (puntos_ganados >= 0)
);

create index if not exists reservas_usuario_id_idx on public.reservas(usuario_id);
create index if not exists reservas_sesion_id_idx on public.reservas(sesion_id);
create index if not exists reservas_funcion_id_idx on public.reservas(funcion_id);
create index if not exists reservas_creada_en_idx on public.reservas(creada_en desc);

create table if not exists public.reserva_asientos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  butaca_id text not null,
  tipo text not null check (tipo in ('regular', 'accesible', 'vip')),
  unique (reserva_id, butaca_id)
);

create index if not exists reserva_asientos_reserva_id_idx on public.reserva_asientos(reserva_id);
create index if not exists reserva_asientos_butaca_id_idx on public.reserva_asientos(butaca_id);

create table if not exists public.reserva_candy (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  item_id uuid not null,
  tipo_item text not null check (tipo_item in ('producto', 'combo')),
  cantidad integer not null check (cantidad > 0),
  precio numeric(12, 2) not null check (precio >= 0)
);

create index if not exists reserva_candy_reserva_id_idx on public.reserva_candy(reserva_id);

create table if not exists public.butacas_bloqueadas (
  funcion_id uuid not null references public.funciones(id) on delete cascade,
  butaca_id text not null,
  sesion_id uuid not null,
  expira_en timestamptz not null,
  primary key (funcion_id, butaca_id)
);

create index if not exists butacas_bloqueadas_expira_en_idx on public.butacas_bloqueadas(expira_en);

create table if not exists public.configuracion_descuentos (
  id boolean primary key default true check (id),
  primera_compra_activa boolean not null default true,
  codigo_primera_compra text not null default 'BIENVENIDA',
  descuento_primera_compra numeric(5, 2) not null default 10 check (descuento_primera_compra between 1 and 100),
  mayores_50_activo boolean not null default false,
  edad_minima integer not null default 50 check (edad_minima between 1 and 120),
  descuento_mayores_50 numeric(5, 2) not null default 20 check (descuento_mayores_50 between 1 and 100),
  valor_punto_pesos numeric(12, 4) not null default 1 check (valor_punto_pesos > 0),
  actualizado_en timestamptz not null default now()
);

insert into public.configuracion_descuentos (id) values (true) on conflict (id) do nothing;

create table if not exists public.movimientos_creditos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  tipo text not null check (tipo in ('devolucion', 'compra')),
  importe numeric(12, 2) not null check (importe > 0),
  creado_en timestamptz not null default now(),
  unique (reserva_id, tipo)
);

create table if not exists public.movimientos_puntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  reserva_id uuid references public.reservas(id) on delete set null,
  tipo text not null check (tipo in ('acumulacion', 'reversion', 'canje')),
  puntos numeric(14, 2) not null check (puntos > 0),
  creditos_generados numeric(12, 2) not null default 0 check (creditos_generados >= 0),
  creado_en timestamptz not null default now(),
  unique (reserva_id, tipo)
);

create table if not exists public.resenas_peliculas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  pelicula_id uuid not null references public.peliculas(id) on delete cascade,
  puntuacion smallint not null check (puntuacion between 1 and 5),
  comentario varchar(240) not null check (length(trim(comentario)) between 1 and 240),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  unique (usuario_id, pelicula_id)
);

create table if not exists public.log_auditoria (
  id bigint generated always as identity primary key,
  ocurrido_en timestamptz not null default now(),
  usuario_id uuid references auth.users(id) on delete set null,
  usuario_nombre text not null,
  accion text not null check (accion in ('Alta', 'Modificación', 'Eliminación')),
  entidad text not null,
  registro_id text,
  descripcion text not null
);

create index if not exists log_auditoria_ocurrido_en_idx on public.log_auditoria(ocurrido_en desc);

-- -----------------------------------------------------------------------------
-- Seguridad y políticas RLS
-- -----------------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

alter table public.perfiles enable row level security;
alter table public.peliculas enable row level security;
alter table public.salas enable row level security;
alter table public.funciones enable row level security;
alter table public.candy_categorias enable row level security;
alter table public.candy_productos enable row level security;
alter table public.candy_combos enable row level security;
alter table public.candy_combo_items enable row level security;
alter table public.reservas enable row level security;
alter table public.reserva_asientos enable row level security;
alter table public.reserva_candy enable row level security;
alter table public.butacas_bloqueadas enable row level security;
alter table public.configuracion_descuentos enable row level security;
alter table public.movimientos_creditos enable row level security;
alter table public.movimientos_puntos enable row level security;
alter table public.resenas_peliculas enable row level security;
alter table public.log_auditoria enable row level security;

-- Catálogo público; administración protegida por rol.
drop policy if exists peliculas_lectura_publica on public.peliculas;
create policy peliculas_lectura_publica on public.peliculas for select to anon, authenticated using (true);
drop policy if exists peliculas_admin_gestiona on public.peliculas;
create policy peliculas_admin_gestiona on public.peliculas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists salas_lectura_publica on public.salas;
create policy salas_lectura_publica on public.salas for select to anon, authenticated using (true);
drop policy if exists salas_admin_gestiona on public.salas;
create policy salas_admin_gestiona on public.salas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists funciones_lectura_publica on public.funciones;
create policy funciones_lectura_publica on public.funciones for select to anon, authenticated using (true);
drop policy if exists funciones_admin_gestiona on public.funciones;
create policy funciones_admin_gestiona on public.funciones for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists candy_categorias_lectura_publica on public.candy_categorias;
create policy candy_categorias_lectura_publica on public.candy_categorias for select to anon, authenticated using (true);
drop policy if exists candy_categorias_admin_gestiona on public.candy_categorias;
create policy candy_categorias_admin_gestiona on public.candy_categorias for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists candy_productos_lectura_publica on public.candy_productos;
create policy candy_productos_lectura_publica on public.candy_productos for select to anon, authenticated using (true);
drop policy if exists candy_productos_admin_gestiona on public.candy_productos;
create policy candy_productos_admin_gestiona on public.candy_productos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists candy_combos_lectura_publica on public.candy_combos;
create policy candy_combos_lectura_publica on public.candy_combos for select to anon, authenticated using (true);
drop policy if exists candy_combos_admin_gestiona on public.candy_combos;
create policy candy_combos_admin_gestiona on public.candy_combos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists candy_combo_items_lectura_publica on public.candy_combo_items;
create policy candy_combo_items_lectura_publica on public.candy_combo_items for select to anon, authenticated using (true);
drop policy if exists candy_combo_items_admin_gestiona on public.candy_combo_items;
create policy candy_combo_items_admin_gestiona on public.candy_combo_items for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Cada perfil puede consultar su fila. Los perfiles nuevos no pueden asignarse rol admin.
drop policy if exists perfiles_consulta_propia_o_admin on public.perfiles;
create policy perfiles_consulta_propia_o_admin on public.perfiles for select to authenticated using (id = auth.uid() or public.es_admin());
drop policy if exists perfiles_registro_propio on public.perfiles;
create policy perfiles_registro_propio on public.perfiles for insert to authenticated with check (id = auth.uid() and rol <> 'admin');
drop policy if exists perfiles_admin_gestiona on public.perfiles;
create policy perfiles_admin_gestiona on public.perfiles for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Las reservas usan UUID como identificador de ticket. Esta política amplia permite
-- consultar tickets anónimos y contar butacas desde la cartelera; no guardar PII en reservas.
drop policy if exists reservas_lectura_app on public.reservas;
create policy reservas_lectura_app on public.reservas for select to anon, authenticated using (true);
drop policy if exists reservas_creacion_app on public.reservas;
create policy reservas_creacion_app on public.reservas for insert to anon, authenticated with check (
  (auth.uid() is null and usuario_id is null) or usuario_id = auth.uid()
);
drop policy if exists reservas_admin_actualiza on public.reservas;
create policy reservas_admin_actualiza on public.reservas for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists reserva_asientos_lectura_app on public.reserva_asientos;
create policy reserva_asientos_lectura_app on public.reserva_asientos for select to anon, authenticated using (true);
drop policy if exists reserva_asientos_inserta_app on public.reserva_asientos;
create policy reserva_asientos_inserta_app on public.reserva_asientos for insert to anon, authenticated with check (
  exists (
    select 1 from public.reservas r
    where r.id = reserva_id
      and ((auth.uid() is null and r.usuario_id is null) or r.usuario_id = auth.uid())
  )
);
drop policy if exists reserva_asientos_admin_gestiona on public.reserva_asientos;
create policy reserva_asientos_admin_gestiona on public.reserva_asientos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists reserva_candy_lectura_app on public.reserva_candy;
create policy reserva_candy_lectura_app on public.reserva_candy for select to anon, authenticated using (true);
drop policy if exists reserva_candy_inserta_app on public.reserva_candy;
create policy reserva_candy_inserta_app on public.reserva_candy for insert to anon, authenticated with check (
  exists (
    select 1 from public.reservas r
    where r.id = reserva_id
      and ((auth.uid() is null and r.usuario_id is null) or r.usuario_id = auth.uid())
  )
);
drop policy if exists reserva_candy_admin_gestiona on public.reserva_candy;
create policy reserva_candy_admin_gestiona on public.reserva_candy for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Los bloqueos temporales no contienen datos personales y se manipulan por sesión.
drop policy if exists butacas_bloqueadas_lectura_publica on public.butacas_bloqueadas;
create policy butacas_bloqueadas_lectura_publica on public.butacas_bloqueadas for select to anon, authenticated using (true);
drop policy if exists butacas_bloqueadas_libera_sesion on public.butacas_bloqueadas;
create policy butacas_bloqueadas_libera_sesion on public.butacas_bloqueadas for delete to anon, authenticated using (true);

-- La configuración se puede leer en checkout; solo admin puede modificarla.
drop policy if exists configuracion_descuentos_lectura_publica on public.configuracion_descuentos;
create policy configuracion_descuentos_lectura_publica on public.configuracion_descuentos for select to anon, authenticated using (true);
drop policy if exists configuracion_descuentos_admin_gestiona on public.configuracion_descuentos;
create policy configuracion_descuentos_admin_gestiona on public.configuracion_descuentos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists movimientos_creditos_propios on public.movimientos_creditos;
create policy movimientos_creditos_propios on public.movimientos_creditos for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists movimientos_puntos_propios on public.movimientos_puntos;
create policy movimientos_puntos_propios on public.movimientos_puntos for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists resenas_propias on public.resenas_peliculas;
create policy resenas_propias on public.resenas_peliculas for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists log_auditoria_solo_admin on public.log_auditoria;
create policy log_auditoria_solo_admin on public.log_auditoria for select to authenticated using (public.es_admin());

-- Grants para las consultas y operaciones directas usadas por el cliente.
grant select on public.peliculas, public.salas, public.funciones,
  public.candy_categorias, public.candy_productos, public.candy_combos,
  public.candy_combo_items, public.reservas, public.reserva_asientos,
  public.reserva_candy, public.butacas_bloqueadas, public.configuracion_descuentos
  to anon, authenticated;
grant insert on public.perfiles, public.reservas, public.reserva_asientos, public.reserva_candy to authenticated;
grant insert on public.reservas, public.reserva_asientos, public.reserva_candy to anon;
grant update, insert, delete on public.peliculas, public.salas, public.funciones,
  public.candy_categorias, public.candy_productos, public.candy_combos,
  public.candy_combo_items, public.configuracion_descuentos to authenticated;
grant update on public.reservas to authenticated;
grant delete on public.butacas_bloqueadas to anon, authenticated;
grant select on public.movimientos_creditos, public.movimientos_puntos,
  public.resenas_peliculas, public.log_auditoria to authenticated;

-- -----------------------------------------------------------------------------
-- Funciones RPC
-- -----------------------------------------------------------------------------

create or replace function public.es_primera_compra(p_sesion_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.reservas
    where (auth.uid() is not null and usuario_id = auth.uid())
       or (auth.uid() is null and sesion_id = p_sesion_id)
  );
$$;
grant execute on function public.es_primera_compra(uuid) to anon, authenticated;

create or replace function public.obtener_conteo_generos_funciones()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(conteos.genero, conteos.cantidad), '{}'::jsonb)
  from (
    select trim(genero) as genero, count(*)::integer as cantidad
    from public.funciones f
    join public.peliculas p on p.id = f.pelicula_id
    cross join lateral unnest(p.generos) as genero
    where f.fecha_hora_inicio >= now()
    group by trim(genero)
  ) conteos;
$$;
grant execute on function public.obtener_conteo_generos_funciones() to anon, authenticated;

create or replace function public.bloquear_butaca(p_funcion_id uuid, p_butaca_id text, p_sesion_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bloqueada boolean;
begin
  if p_funcion_id is null or p_butaca_id is null or p_sesion_id is null then
    return false;
  end if;
  if exists (
    select 1 from public.reserva_asientos ra
    join public.reservas r on r.id = ra.reserva_id
    where r.funcion_id = p_funcion_id and ra.butaca_id = p_butaca_id and r.cancelada_en is null
  ) then
    return false;
  end if;

  insert into public.butacas_bloqueadas(funcion_id, butaca_id, sesion_id, expira_en)
  values (p_funcion_id, p_butaca_id, p_sesion_id, now() + interval '5 minutes')
  on conflict (funcion_id, butaca_id) do update
    set sesion_id = excluded.sesion_id,
        expira_en = excluded.expira_en
    where public.butacas_bloqueadas.expira_en <= now()
       or public.butacas_bloqueadas.sesion_id = excluded.sesion_id
  returning true into v_bloqueada;

  return coalesce(v_bloqueada, false);
end;
$$;
revoke all on function public.bloquear_butaca(uuid, text, uuid) from public;
grant execute on function public.bloquear_butaca(uuid, text, uuid) to anon, authenticated;

create or replace function public.actualizar_perfil_usuario(
  p_nombre text,
  p_apellido text,
  p_fecha_nacimiento date,
  p_tipo_sangre text,
  p_color_ojos text,
  p_dias_vacaciones integer
)
returns public.perfiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  perfil_actualizado public.perfiles;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión para actualizar el perfil.'; end if;
  if p_dias_vacaciones is null or p_dias_vacaciones < 0 or p_dias_vacaciones > 365 then
    raise exception 'Los días de vacaciones deben ser un número entero entre 0 y 365.';
  end if;
  update public.perfiles
  set nombre = p_nombre, apellido = p_apellido, fecha_nacimiento = p_fecha_nacimiento,
      tipo_sangre = p_tipo_sangre, color_ojos = p_color_ojos, dias_vacaciones = p_dias_vacaciones
  where id = auth.uid()
  returning * into perfil_actualizado;
  if not found then raise exception 'No se encontró el perfil del usuario autenticado.'; end if;
  return perfil_actualizado;
end;
$$;
revoke all on function public.actualizar_perfil_usuario(text, text, date, text, text, integer) from public, anon;
grant execute on function public.actualizar_perfil_usuario(text, text, date, text, text, integer) to authenticated;

create or replace function public.cancelar_compra_por_creditos(p_reserva_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  compra public.reservas;
  nuevo_saldo numeric(12, 2);
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión para cancelar la compra.'; end if;
  select * into compra from public.reservas
  where id = p_reserva_id and usuario_id = auth.uid() for update;
  if not found then raise exception 'No se encontró una compra de este usuario.'; end if;
  if compra.cancelada_en is not null then raise exception 'Esta compra ya fue cancelada.'; end if;
  if coalesce(compra.entradas_retiradas, false) or coalesce(compra.candy_retirado, false) then
    raise exception 'No se puede cancelar una compra que ya fue utilizada.';
  end if;
  update public.perfiles set creditos = creditos + compra.total
  where id = auth.uid() returning creditos into nuevo_saldo;
  if not found then raise exception 'No se encontró el perfil para acreditar la devolución.'; end if;
  update public.reservas set cancelada_en = now() where id = compra.id;
  delete from public.reserva_asientos where reserva_id = compra.id;
  if compra.total > 0 then
    insert into public.movimientos_creditos(usuario_id, reserva_id, tipo, importe)
    values (auth.uid(), compra.id, 'devolucion', compra.total);
  end if;
  return jsonb_build_object('reserva_id', compra.id, 'importe_devuelto', compra.total, 'saldo_creditos', nuevo_saldo);
end;
$$;
revoke all on function public.cancelar_compra_por_creditos(uuid) from public, anon;
grant execute on function public.cancelar_compra_por_creditos(uuid) to authenticated;

create or replace function public.guardar_resena_pelicula(p_pelicula_id uuid, p_puntuacion smallint, p_comentario text)
returns public.resenas_peliculas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resena_guardada public.resenas_peliculas;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión para dejar una reseña.'; end if;
  if p_puntuacion not between 1 and 5 then raise exception 'La calificación debe estar entre 1 y 5 estrellas.'; end if;
  if length(trim(p_comentario)) not between 1 and 240 then raise exception 'El comentario debe tener entre 1 y 240 caracteres.'; end if;
  if not exists (
    select 1 from public.reservas r
    join public.funciones f on f.id = r.funcion_id
    where r.usuario_id = auth.uid() and r.cancelada_en is null
      and coalesce(r.entradas_retiradas, false) and f.pelicula_id = p_pelicula_id
  ) then raise exception 'Solo puedes reseñar películas con entradas verificadas en tu cuenta.'; end if;
  insert into public.resenas_peliculas(usuario_id, pelicula_id, puntuacion, comentario)
  values (auth.uid(), p_pelicula_id, p_puntuacion, trim(p_comentario))
  on conflict (usuario_id, pelicula_id) do update
    set puntuacion = excluded.puntuacion, comentario = excluded.comentario, actualizada_en = now()
  returning * into resena_guardada;
  return resena_guardada;
end;
$$;
revoke all on function public.guardar_resena_pelicula(uuid, smallint, text) from public, anon;
grant execute on function public.guardar_resena_pelicula(uuid, smallint, text) to authenticated;

create or replace function public.obtener_calificacion_pelicula(p_pelicula_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('promedio', coalesce(avg(puntuacion), 0), 'cantidad', count(*))
  from public.resenas_peliculas where pelicula_id = p_pelicula_id;
$$;
revoke all on function public.obtener_calificacion_pelicula(uuid) from public;
grant execute on function public.obtener_calificacion_pelicula(uuid) to anon, authenticated;

create or replace function public.obtener_metricas_administrador(p_periodo text default 'semana')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio_periodo date;
  v_resultado jsonb;
begin
  if auth.uid() is null or not public.es_admin() then raise exception 'Se requieren permisos de administrador.'; end if;
  if p_periodo not in ('semana', 'mes') then raise exception 'El periodo debe ser semana o mes.'; end if;
  v_inicio_periodo := case p_periodo when 'mes' then date_trunc('month', current_date)::date else date_trunc('week', current_date)::date end;
  select jsonb_build_object(
    'facturacion_hoy', coalesce((select sum(total) from public.reservas where cancelada_en is null and creada_en::date = current_date), 0),
    'entradas_hoy', coalesce((select sum(entradas_compradas) from public.reservas where cancelada_en is null and creada_en::date = current_date), 0),
    'facturacion_diaria', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', dias.fecha, 'monto', coalesce(ventas.monto, 0), 'entradas', coalesce(ventas.entradas, 0)) order by dias.fecha)
      from generate_series(current_date - 6, current_date, interval '1 day') as dias(fecha)
      left join lateral (
        select sum(r.total) as monto, sum(r.entradas_compradas) as entradas
        from public.reservas r where r.cancelada_en is null and r.creada_en::date = dias.fecha::date
      ) ventas on true
    ), '[]'::jsonb),
    'peliculas_mas_vistas', coalesce((
      select jsonb_agg(to_jsonb(ranking)) from (
        select p.nombre, sum(r.entradas_compradas)::integer as entradas
        from public.reservas r join public.funciones f on f.id = r.funcion_id
        join public.peliculas p on p.id = f.pelicula_id
        where r.cancelada_en is null and r.creada_en >= v_inicio_periodo
          and r.creada_en < case p_periodo when 'mes' then v_inicio_periodo + interval '1 month' else v_inicio_periodo + interval '1 week' end
        group by p.id, p.nombre order by entradas desc, p.nombre limit 5
      ) ranking
    ), '[]'::jsonb),
    'productos_mas_solicitados', coalesce((
      select jsonb_agg(to_jsonb(ranking)) from (
        select pedidos.nombre, pedidos.tipo, sum(pedidos.cantidad)::integer as cantidad
        from (
          select coalesce(cp.nombre, 'Producto eliminado') as nombre, 'producto'::text as tipo, rc.cantidad
          from public.reserva_candy rc join public.reservas r on r.id = rc.reserva_id
          left join public.candy_productos cp on cp.id = rc.item_id
          where rc.tipo_item = 'producto' and r.cancelada_en is null
          union all
          select coalesce(cc.nombre, 'Combo eliminado'), 'combo'::text, rc.cantidad
          from public.reserva_candy rc join public.reservas r on r.id = rc.reserva_id
          left join public.candy_combos cc on cc.id = rc.item_id
          where rc.tipo_item = 'combo' and r.cancelada_en is null
        ) pedidos
        group by pedidos.nombre, pedidos.tipo order by cantidad desc, pedidos.nombre limit 5
      ) ranking
    ), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function public.obtener_metricas_administrador(text) from public, anon;
grant execute on function public.obtener_metricas_administrador(text) to authenticated;

create or replace function public.registrar_puntos_compra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_puntos numeric(14, 2);
begin
  if new.usuario_id is null or new.cancelada_en is not null then return new; end if;
  if new.metodo_pago = 'creditos' then v_puntos := floor(greatest(coalesce(new.importe_externo, 0), 0));
  else v_puntos := floor(greatest(new.total, 0)); end if;
  if v_puntos <= 0 then return new; end if;
  update public.reservas set puntos_ganados = v_puntos where id = new.id;
  update public.perfiles set puntos = puntos + v_puntos where id = new.usuario_id;
  insert into public.movimientos_puntos(usuario_id, reserva_id, tipo, puntos)
  values (new.usuario_id, new.id, 'acumulacion', v_puntos)
  on conflict (reserva_id, tipo) do nothing;
  return new;
end;
$$;
drop trigger if exists reservas_acreditar_puntos on public.reservas;
create trigger reservas_acreditar_puntos after insert on public.reservas for each row execute function public.registrar_puntos_compra();

create or replace function public.revertir_puntos_compra_cancelada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cancelada_en is null and new.cancelada_en is not null and new.usuario_id is not null and new.puntos_ganados > 0 then
    update public.perfiles set puntos = puntos - new.puntos_ganados
    where id = new.usuario_id and puntos >= new.puntos_ganados;
    if not found then raise exception 'No se puede cancelar: ya se utilizaron los puntos de esta compra.'; end if;
    insert into public.movimientos_puntos(usuario_id, reserva_id, tipo, puntos)
    values (new.usuario_id, new.id, 'reversion', new.puntos_ganados)
    on conflict (reserva_id, tipo) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists reservas_revertir_puntos_cancelacion on public.reservas;
create trigger reservas_revertir_puntos_cancelacion after update of cancelada_en on public.reservas for each row execute function public.revertir_puntos_compra_cancelada();

create or replace function public.canjear_puntos_por_creditos(p_puntos numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saldo_puntos numeric(14,2);
  valor_punto numeric(12,4);
  saldo_creditos numeric(12,2);
  creditos_generados numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Inicia sesión para canjear puntos.'; end if;
  if p_puntos is null or p_puntos <= 0 or p_puntos <> floor(p_puntos) then raise exception 'Solo puedes canjear puntos enteros positivos.'; end if;
  select puntos, creditos into saldo_puntos, saldo_creditos from public.perfiles where id = auth.uid() for update;
  if not found then raise exception 'No se encontró el perfil de esta cuenta.'; end if;
  if p_puntos > saldo_puntos then raise exception 'No tienes suficientes puntos.'; end if;
  select valor_punto_pesos into valor_punto from public.configuracion_descuentos where id = true for share;
  if valor_punto is null or valor_punto <= 0 then raise exception 'La tasa de canje no está configurada.'; end if;
  creditos_generados := round(p_puntos * valor_punto, 2);
  if creditos_generados <= 0 then raise exception 'La cantidad de puntos no genera créditos.'; end if;
  update public.perfiles set puntos = puntos - p_puntos, creditos = creditos + creditos_generados
  where id = auth.uid() returning creditos into saldo_creditos;
  insert into public.movimientos_puntos(usuario_id, tipo, puntos, creditos_generados)
  values (auth.uid(), 'canje', p_puntos, creditos_generados);
  return jsonb_build_object('puntos_restantes', saldo_puntos - p_puntos, 'creditos_generados', creditos_generados, 'saldo_creditos', saldo_creditos, 'valor_punto_pesos', valor_punto);
end;
$$;
revoke all on function public.canjear_puntos_por_creditos(numeric) from public, anon;
grant execute on function public.canjear_puntos_por_creditos(numeric) to authenticated;

create or replace function public.comprar_con_creditos(
  p_funcion_id uuid,
  p_sesion_id uuid,
  p_butacas jsonb,
  p_items_candy jsonb,
  p_total_esperado numeric,
  p_codigo_cupon text,
  p_fecha_nacimiento date,
  p_creditos_usados numeric,
  p_metodo_externo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_precio_base numeric(12,2);
  v_total_entradas numeric(12,2) := 0;
  v_total_candy numeric(12,2) := 0;
  v_subtotal numeric(12,2);
  v_descuento_cupon numeric(12,2) := 0;
  v_descuento_edad numeric(12,2) := 0;
  v_descuento numeric(12,2) := 0;
  v_tipo_descuento text;
  v_total_final numeric(12,2);
  v_creditos_usados numeric(12,2);
  v_saldo numeric(12,2);
  v_nuevo_saldo numeric(12,2);
  v_total_asientos integer;
  v_asientos_unicos integer;
  v_bloqueos integer;
  v_cantidad integer;
  v_stock integer;
  v_precio_item numeric(12,2);
  v_item jsonb;
  v_candy_normalizado jsonb := '[]'::jsonb;
  v_reserva_id uuid;
  v_config public.configuracion_descuentos%rowtype;
  v_tipo_entrada text;
  v_importe_externo numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Inicia sesión para pagar con créditos.'; end if;
  if jsonb_typeof(p_butacas) <> 'array' or jsonb_array_length(p_butacas) = 0 then raise exception 'Selecciona al menos una butaca.'; end if;
  if jsonb_typeof(coalesce(p_items_candy, '[]'::jsonb)) <> 'array' then raise exception 'El carrito de Candy no es válido.'; end if;
  if p_metodo_externo is not null and p_metodo_externo not in ('mp', 'tarjeta') then raise exception 'El medio de pago externo no es válido.'; end if;

  select creditos into v_saldo from public.perfiles where id = auth.uid() for update;
  if not found then raise exception 'No se encontró el perfil de esta cuenta.'; end if;
  select coalesce(case when p.fecha_estreno > current_date then p.precio_preventa else p.precio_base end, p.precio_base)
  into v_precio_base from public.funciones f join public.peliculas p on p.id = f.pelicula_id where f.id = p_funcion_id;
  if not found or v_precio_base is null or v_precio_base < 0 then raise exception 'No se encontró el precio de esta función.'; end if;

  select count(*), count(distinct elemento.value->>'id') into v_total_asientos, v_asientos_unicos
  from jsonb_array_elements(p_butacas) elemento(value);
  if v_total_asientos <> v_asientos_unicos then raise exception 'La selección contiene butacas duplicadas.'; end if;
  select count(*) into v_bloqueos
  from jsonb_array_elements(p_butacas) elemento(value)
  join public.butacas_bloqueadas bloqueo on bloqueo.butaca_id = elemento.value->>'id'
    and bloqueo.funcion_id = p_funcion_id and bloqueo.sesion_id = p_sesion_id and bloqueo.expira_en > now();
  if v_bloqueos <> v_total_asientos then raise exception 'Una o más butacas ya no están reservadas para esta sesión.'; end if;

  for v_item in select elemento.value from jsonb_array_elements(p_butacas) elemento(value) loop
    v_tipo_entrada := v_item->>'tipo';
    if v_tipo_entrada = 'regular' then v_total_entradas := v_total_entradas + v_precio_base;
    elsif v_tipo_entrada = 'accesible' then v_total_entradas := v_total_entradas + v_precio_base * 0.5;
    elsif v_tipo_entrada = 'vip' then v_total_entradas := v_total_entradas + v_precio_base * 1.5;
    else raise exception 'El tipo de butaca no es válido.'; end if;
  end loop;

  for v_item in select elemento.value from jsonb_array_elements(coalesce(p_items_candy, '[]'::jsonb)) elemento(value) loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad < 1 or v_cantidad > 50 then raise exception 'La cantidad de un producto no es válida.'; end if;
    if v_item->>'tipo' = 'producto' then
      select precio, stock into v_precio_item, v_stock from public.candy_productos where id = (v_item->>'id')::uuid for update;
      if not found or v_stock < v_cantidad then raise exception 'Un producto de Candy ya no tiene stock suficiente.'; end if;
      update public.candy_productos set stock = stock - v_cantidad where id = (v_item->>'id')::uuid;
    elsif v_item->>'tipo' = 'combo' then
      select precio_combo into v_precio_item from public.candy_combos where id = (v_item->>'id')::uuid for share;
      if not found then raise exception 'Un combo de Candy ya no está disponible.'; end if;
    else raise exception 'El tipo de producto de Candy no es válido.'; end if;
    v_total_candy := v_total_candy + v_precio_item * v_cantidad;
    v_candy_normalizado := v_candy_normalizado || jsonb_build_array(jsonb_build_object('id', v_item->>'id', 'tipo', v_item->>'tipo', 'cantidad', v_cantidad, 'precio', v_precio_item));
  end loop;

  v_subtotal := v_total_entradas + v_total_candy;
  select * into v_config from public.configuracion_descuentos where id = true for share;
  if p_codigo_cupon is not null and length(trim(p_codigo_cupon)) > 0 then
    if not coalesce(v_config.primera_compra_activa, false) or upper(trim(p_codigo_cupon)) <> upper(trim(v_config.codigo_primera_compra)) then raise exception 'El cupón no es válido o ya no está activo.'; end if;
    if exists (select 1 from public.reservas where usuario_id = auth.uid()) then raise exception 'El cupón de primera compra ya fue utilizado.'; end if;
    v_descuento_cupon := round(v_subtotal * v_config.descuento_primera_compra / 100, 0);
  end if;
  if coalesce(v_config.mayores_50_activo, false) and p_fecha_nacimiento is not null and p_fecha_nacimiento <= current_date
     and extract(year from age(current_date, p_fecha_nacimiento)) >= v_config.edad_minima then
    v_descuento_edad := round(v_total_entradas * v_config.descuento_mayores_50 / 100, 0);
  end if;
  if v_descuento_cupon >= v_descuento_edad and v_descuento_cupon > 0 then v_descuento := v_descuento_cupon; v_tipo_descuento := 'primera_compra';
  elsif v_descuento_edad > 0 then v_descuento := v_descuento_edad; v_tipo_descuento := 'mayores_50'; end if;

  v_total_final := greatest(0, v_subtotal - v_descuento);
  if p_total_esperado is null or abs(p_total_esperado - v_total_final) > 0.01 then raise exception 'El total cambió. Actualiza el checkout antes de pagar.'; end if;
  v_creditos_usados := coalesce(p_creditos_usados, 0);
  if v_creditos_usados < 0 or v_creditos_usados > v_total_final then raise exception 'El importe de créditos no es válido.'; end if;
  if v_creditos_usados > v_saldo then raise exception 'Créditos insuficientes. Saldo disponible: %.', v_saldo; end if;
  if p_metodo_externo is null then
    if v_creditos_usados <> v_total_final then raise exception 'El saldo no alcanza. Elige un segundo medio de pago.'; end if;
    v_importe_externo := 0;
  else
    if v_creditos_usados >= v_total_final then raise exception 'No queda un importe pendiente para el medio de pago externo.'; end if;
    v_importe_externo := v_total_final - v_creditos_usados;
  end if;

  insert into public.reservas(funcion_id, total, metodo_pago, metodo_pago_secundario, creditos_usados, importe_externo, usuario_id, sesion_id, entradas_compradas, descuento, tipo_descuento, codigo_cupon)
  values (p_funcion_id, v_total_final, 'creditos', p_metodo_externo, v_creditos_usados, v_importe_externo, auth.uid(), p_sesion_id, v_total_asientos, v_descuento, v_tipo_descuento,
    case when v_tipo_descuento = 'primera_compra' then upper(trim(p_codigo_cupon)) else null end)
  returning id into v_reserva_id;

  insert into public.reserva_asientos(reserva_id, butaca_id, tipo)
  select v_reserva_id, elemento.value->>'id', elemento.value->>'tipo' from jsonb_array_elements(p_butacas) elemento(value);
  for v_item in select elemento.value from jsonb_array_elements(v_candy_normalizado) elemento(value) loop
    insert into public.reserva_candy(reserva_id, item_id, tipo_item, cantidad, precio)
    values (v_reserva_id, (v_item->>'id')::uuid, v_item->>'tipo', (v_item->>'cantidad')::integer, (v_item->>'precio')::numeric);
  end loop;

  update public.perfiles set creditos = creditos - v_creditos_usados where id = auth.uid() returning creditos into v_nuevo_saldo;
  if v_creditos_usados > 0 then
    insert into public.movimientos_creditos(usuario_id, reserva_id, tipo, importe) values (auth.uid(), v_reserva_id, 'compra', v_creditos_usados);
  end if;
  delete from public.butacas_bloqueadas where sesion_id = p_sesion_id;
  return jsonb_build_object('reserva_id', v_reserva_id, 'total', v_total_final, 'creditos_usados', v_creditos_usados,
    'importe_externo', v_total_final - v_creditos_usados, 'descuento', v_descuento, 'tipo_descuento', v_tipo_descuento, 'saldo_creditos', v_nuevo_saldo);
end;
$$;
revoke all on function public.comprar_con_creditos(uuid, uuid, jsonb, jsonb, numeric, text, date, numeric, text) from public, anon;
grant execute on function public.comprar_con_creditos(uuid, uuid, jsonb, jsonb, numeric, text, date, numeric, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Auditoría automática
-- -----------------------------------------------------------------------------

create or replace function public.registrar_evento_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_datos jsonb;
  v_usuario_id uuid;
  v_usuario_nombre text;
  v_entidad text;
  v_descripcion text;
  v_accion text;
begin
  if tg_op = 'DELETE' then v_datos := to_jsonb(old); else v_datos := to_jsonb(new); end if;
  v_usuario_id := auth.uid();
  if v_usuario_id is null and nullif(v_datos->>'usuario_id', '') is not null then v_usuario_id := (v_datos->>'usuario_id')::uuid; end if;
  select coalesce(nullif(trim(concat_ws(' ', p.nombre, p.apellido)), ''), u.email)
  into v_usuario_nombre from auth.users u left join public.perfiles p on p.id = u.id where u.id = v_usuario_id;
  v_usuario_nombre := coalesce(v_usuario_nombre, 'Usuario invitado');
  v_accion := case tg_op when 'INSERT' then 'Alta' when 'UPDATE' then 'Modificación' else 'Eliminación' end;
  v_entidad := case tg_table_name
    when 'peliculas' then 'Película' when 'funciones' then 'Función'
    when 'candy_categorias' then 'Categoría Candy Bar' when 'candy_productos' then 'Producto Candy Bar'
    when 'candy_combos' then 'Combo Candy Bar' when 'candy_combo_items' then 'Contenido de combo'
    when 'configuracion_descuentos' then 'Configuración de descuentos' when 'perfiles' then 'Perfil de usuario'
    when 'resenas_peliculas' then 'Reseña de película' when 'reservas' then 'Compra o reserva'
    when 'reserva_asientos' then 'Butaca reservada' when 'reserva_candy' then 'Producto de una reserva'
    when 'movimientos_creditos' then 'Movimiento de créditos' when 'movimientos_puntos' then 'Movimiento de puntos'
    else tg_table_name end;
  v_descripcion := v_entidad || ': ' || coalesce(nullif(trim(v_datos->>'nombre'), ''), nullif(trim(v_datos->>'codigo_primera_compra'), ''), nullif(trim(v_datos->>'id'), ''), 'registro');
  insert into public.log_auditoria(usuario_id, usuario_nombre, accion, entidad, registro_id, descripcion)
  values (v_usuario_id, v_usuario_nombre, v_accion, v_entidad, v_datos->>'id', v_descripcion);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.registrar_evento_auditoria() from public, anon, authenticated;

do $$
declare v_tabla text;
begin
  foreach v_tabla in array array['peliculas','funciones','candy_categorias','candy_productos','candy_combos','candy_combo_items','configuracion_descuentos','perfiles','resenas_peliculas','reservas','reserva_asientos','reserva_candy','movimientos_creditos','movimientos_puntos'] loop
    execute format('drop trigger if exists registrar_evento_auditoria on public.%I', v_tabla);
    execute format('create trigger registrar_evento_auditoria after insert or update or delete on public.%I for each row execute function public.registrar_evento_auditoria()', v_tabla);
  end loop;
end;
$$;

grant select on public.log_auditoria to authenticated;
revoke insert, update, delete, truncate on public.log_auditoria from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage de imágenes
-- -----------------------------------------------------------------------------

insert into storage.buckets(id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists imagenes_lectura_publica on storage.objects;
create policy imagenes_lectura_publica on storage.objects for select to anon, authenticated using (bucket_id = 'imagenes');
drop policy if exists imagenes_admin_inserta on storage.objects;
create policy imagenes_admin_inserta on storage.objects for insert to authenticated with check (bucket_id = 'imagenes' and public.es_admin());
drop policy if exists imagenes_admin_actualiza on storage.objects;
create policy imagenes_admin_actualiza on storage.objects for update to authenticated using (bucket_id = 'imagenes' and public.es_admin()) with check (bucket_id = 'imagenes' and public.es_admin());
drop policy if exists imagenes_admin_elimina on storage.objects;
create policy imagenes_admin_elimina on storage.objects for delete to authenticated using (bucket_id = 'imagenes' and public.es_admin());

notify pgrst, 'reload schema';

commit;
