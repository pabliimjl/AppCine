alter table public.perfiles
  add column if not exists creditos numeric(12, 2) not null default 0
    check (creditos >= 0);

alter table public.reservas
  add column if not exists creada_en timestamptz not null default now(),
  add column if not exists cancelada_en timestamptz,
  add column if not exists entradas_compradas integer not null default 0
    check (entradas_compradas >= 0);

create table if not exists public.movimientos_creditos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  reserva_id uuid not null unique references public.reservas(id),
  tipo text not null check (tipo = 'devolucion'),
  importe numeric(12, 2) not null check (importe > 0),
  creado_en timestamptz not null default now()
);

alter table public.movimientos_creditos enable row level security;

drop policy if exists "Usuarios leen sus movimientos de creditos" on public.movimientos_creditos;
create policy "Usuarios leen sus movimientos de creditos"
  on public.movimientos_creditos for select
  to authenticated
  using (usuario_id = auth.uid());

grant select on public.movimientos_creditos to authenticated;

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

alter table public.resenas_peliculas enable row level security;

drop policy if exists "Usuarios leen sus resenas" on public.resenas_peliculas;
create policy "Usuarios leen sus resenas"
  on public.resenas_peliculas for select
  to authenticated
  using (usuario_id = auth.uid());

grant select on public.resenas_peliculas to authenticated;

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
  if auth.uid() is null then
    raise exception 'Se requiere una sesión para cancelar la compra.';
  end if;

  select * into compra
  from public.reservas
  where id = p_reserva_id and usuario_id = auth.uid()
  for update;

  if not found then
    raise exception 'No se encontró una compra de este usuario.';
  end if;
  if compra.cancelada_en is not null then
    raise exception 'Esta compra ya fue cancelada.';
  end if;
  if coalesce(compra.entradas_retiradas, false) or coalesce(compra.candy_retirado, false) then
    raise exception 'No se puede cancelar una compra que ya fue utilizada.';
  end if;

  update public.perfiles
  set creditos = creditos + compra.total
  where id = auth.uid()
  returning creditos into nuevo_saldo;

  if not found then
    raise exception 'No se encontró el perfil para acreditar la devolución.';
  end if;

  update public.reservas
  set cancelada_en = now(),
      entradas_compradas = (
        select count(*)
        from public.reserva_asientos
        where reserva_id = compra.id
      )
  where id = compra.id;

  delete from public.reserva_asientos
  where reserva_id = compra.id;

  if compra.total > 0 then
    insert into public.movimientos_creditos (usuario_id, reserva_id, tipo, importe)
    values (auth.uid(), compra.id, 'devolucion', compra.total);
  end if;

  return jsonb_build_object(
    'reserva_id', compra.id,
    'importe_devuelto', compra.total,
    'saldo_creditos', nuevo_saldo
  );
end;
$$;

revoke all on function public.cancelar_compra_por_creditos(uuid) from public, anon;
grant execute on function public.cancelar_compra_por_creditos(uuid) to authenticated;

create or replace function public.guardar_resena_pelicula(
  p_pelicula_id uuid,
  p_puntuacion smallint,
  p_comentario text
)
returns public.resenas_peliculas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resena_guardada public.resenas_peliculas;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión para dejar una reseña.';
  end if;
  if p_puntuacion not between 1 and 5 then
    raise exception 'La calificación debe estar entre 1 y 5 estrellas.';
  end if;
  if length(trim(p_comentario)) not between 1 and 240 then
    raise exception 'El comentario debe tener entre 1 y 240 caracteres.';
  end if;
  if not exists (
    select 1
    from public.reservas r
    join public.funciones f on f.id = r.funcion_id
    where r.usuario_id = auth.uid()
      and r.cancelada_en is null
      and coalesce(r.entradas_retiradas, false)
      and f.pelicula_id = p_pelicula_id
  ) then
    raise exception 'Solo puedes reseñar películas con entradas verificadas en tu cuenta.';
  end if;

  insert into public.resenas_peliculas (usuario_id, pelicula_id, puntuacion, comentario)
  values (auth.uid(), p_pelicula_id, p_puntuacion, trim(p_comentario))
  on conflict (usuario_id, pelicula_id) do update
    set puntuacion = excluded.puntuacion,
        comentario = excluded.comentario,
        actualizada_en = now()
  returning * into resena_guardada;

  return resena_guardada;
end;
$$;

revoke all on function public.guardar_resena_pelicula(uuid, smallint, text) from public, anon;
grant execute on function public.guardar_resena_pelicula(uuid, smallint, text) to authenticated;