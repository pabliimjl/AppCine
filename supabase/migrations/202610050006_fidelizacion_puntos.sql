alter table public.configuracion_descuentos
  add column if not exists valor_punto_pesos numeric(12, 4) not null default 1
    check (valor_punto_pesos > 0);

alter table public.perfiles
  add column if not exists puntos numeric(14, 2) not null default 0
    check (puntos >= 0);

alter table public.reservas
  add column if not exists metodo_pago_secundario text,
  add column if not exists creditos_usados numeric(12, 2) not null default 0,
  add column if not exists importe_externo numeric(12, 2) not null default 0,
  add column if not exists puntos_ganados numeric(14, 2) not null default 0
    check (puntos_ganados >= 0);

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

alter table public.movimientos_puntos enable row level security;

drop policy if exists "Usuarios leen sus movimientos de puntos" on public.movimientos_puntos;
create policy "Usuarios leen sus movimientos de puntos"
  on public.movimientos_puntos for select
  to authenticated
  using (usuario_id = auth.uid());

grant select on public.movimientos_puntos to authenticated;

update public.reservas
set puntos_ganados = case
  when usuario_id is null or cancelada_en is not null then 0
  when metodo_pago = 'creditos' then floor(greatest(coalesce(importe_externo, 0), 0))
  else floor(greatest(total, 0))
end;

with nuevos_movimientos as (
  insert into public.movimientos_puntos (usuario_id, reserva_id, tipo, puntos)
  select usuario_id, id, 'acumulacion', puntos_ganados
  from public.reservas
  where usuario_id is not null
    and cancelada_en is null
    and puntos_ganados > 0
  on conflict (reserva_id, tipo) do nothing
  returning usuario_id, puntos
), puntos_por_usuario as (
  select usuario_id, sum(puntos) as puntos
  from nuevos_movimientos
  group by usuario_id
)
update public.perfiles perfil
set puntos = perfil.puntos + puntos_por_usuario.puntos
from puntos_por_usuario
where perfil.id = puntos_por_usuario.usuario_id;

create or replace function public.registrar_puntos_compra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_puntos_ganados numeric(14, 2);
begin
  if new.usuario_id is null or new.cancelada_en is not null then
    return new;
  end if;

  if new.metodo_pago = 'creditos' then
    v_puntos_ganados := floor(greatest(coalesce(new.importe_externo, 0), 0));
  else
    v_puntos_ganados := floor(greatest(new.total, 0));
  end if;

  if v_puntos_ganados <= 0 then
    return new;
  end if;

  update public.reservas
  set puntos_ganados = v_puntos_ganados
  where id = new.id;

  update public.perfiles
  set puntos = puntos + v_puntos_ganados
  where id = new.usuario_id;

  insert into public.movimientos_puntos (usuario_id, reserva_id, tipo, puntos)
  values (new.usuario_id, new.id, 'acumulacion', v_puntos_ganados)
  on conflict (reserva_id, tipo) do nothing;

  return new;
end;
$$;

drop trigger if exists reservas_acreditar_puntos on public.reservas;
create trigger reservas_acreditar_puntos
  after insert on public.reservas
  for each row execute function public.registrar_puntos_compra();

create or replace function public.revertir_puntos_compra_cancelada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.cancelada_en is null
    and new.cancelada_en is not null
    and new.usuario_id is not null
    and new.puntos_ganados > 0 then
    update public.perfiles
    set puntos = puntos - new.puntos_ganados
    where id = new.usuario_id
      and puntos >= new.puntos_ganados;

    if not found then
      raise exception 'No se puede cancelar: ya se utilizaron los puntos de esta compra.';
    end if;

    insert into public.movimientos_puntos (usuario_id, reserva_id, tipo, puntos)
    values (new.usuario_id, new.id, 'reversion', new.puntos_ganados)
    on conflict (reserva_id, tipo) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists reservas_revertir_puntos_cancelacion on public.reservas;
create trigger reservas_revertir_puntos_cancelacion
  after update of cancelada_en on public.reservas
  for each row execute function public.revertir_puntos_compra_cancelada();

create or replace function public.canjear_puntos_por_creditos(p_puntos numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saldo_puntos numeric(14, 2);
  valor_punto numeric(12, 4);
  saldo_creditos numeric(12, 2);
  creditos_generados numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para canjear puntos.';
  end if;
  if p_puntos is null or p_puntos <= 0 then
    raise exception 'Indica una cantidad de puntos válida.';
  end if;
  if p_puntos <> floor(p_puntos) then
    raise exception 'Solo puedes canjear puntos enteros.';
  end if;

  select puntos, creditos into saldo_puntos, saldo_creditos
  from public.perfiles
  where id = auth.uid()
  for update;
  if not found then
    raise exception 'No se encontró el perfil de esta cuenta.';
  end if;
  if p_puntos > saldo_puntos then
    raise exception 'No tienes suficientes puntos. Saldo disponible: %.', saldo_puntos;
  end if;

  select valor_punto_pesos into valor_punto
  from public.configuracion_descuentos
  where id = true
  for share;
  if valor_punto is null or valor_punto <= 0 then
    raise exception 'La tasa de canje no está configurada.';
  end if;

  creditos_generados := round(p_puntos * valor_punto, 2);
  if creditos_generados <= 0 then
    raise exception 'La cantidad de puntos no genera créditos con la tasa actual.';
  end if;

  update public.perfiles
  set puntos = puntos - p_puntos,
      creditos = creditos + creditos_generados
  where id = auth.uid()
  returning creditos into saldo_creditos;

  insert into public.movimientos_puntos (usuario_id, tipo, puntos, creditos_generados)
  values (auth.uid(), 'canje', p_puntos, creditos_generados);

  return jsonb_build_object(
    'puntos_restantes', saldo_puntos - p_puntos,
    'creditos_generados', creditos_generados,
    'saldo_creditos', saldo_creditos,
    'valor_punto_pesos', valor_punto
  );
end;
$$;

revoke all on function public.canjear_puntos_por_creditos(numeric) from public, anon;
grant execute on function public.canjear_puntos_por_creditos(numeric) to authenticated;

notify pgrst, 'reload schema';