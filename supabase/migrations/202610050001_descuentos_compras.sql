create table if not exists public.configuracion_descuentos (
  id boolean primary key default true check (id),
  primera_compra_activa boolean not null default true,
  codigo_primera_compra text not null default 'BIENVENIDA',
  descuento_primera_compra numeric(5, 2) not null default 10
    check (descuento_primera_compra between 1 and 100),
  mayores_50_activo boolean not null default false,
  edad_minima integer not null default 50 check (edad_minima between 1 and 120),
  descuento_mayores_50 numeric(5, 2) not null default 20
    check (descuento_mayores_50 between 1 and 100),
  actualizado_en timestamptz not null default now()
);

insert into public.configuracion_descuentos (id)
values (true)
on conflict (id) do nothing;

alter table public.configuracion_descuentos enable row level security;

create policy "Lectura pública de configuración de descuentos"
  on public.configuracion_descuentos for select
  to anon, authenticated
  using (true);

create policy "Administradores gestionan configuración de descuentos"
  on public.configuracion_descuentos for all
  to authenticated
  using (
    exists (
      select 1 from public.perfiles
      where perfiles.id = auth.uid() and perfiles.rol = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.perfiles
      where perfiles.id = auth.uid() and perfiles.rol = 'admin'
    )
  );

alter table public.reservas
  add column if not exists usuario_id uuid references auth.users(id) on delete set null,
  add column if not exists sesion_id uuid,
  add column if not exists descuento numeric(10, 2) not null default 0,
  add column if not exists tipo_descuento text,
  add column if not exists codigo_cupon text;

create index if not exists reservas_usuario_id_idx on public.reservas(usuario_id);
create index if not exists reservas_sesion_id_idx on public.reservas(sesion_id);

create or replace function public.es_primera_compra(p_sesion_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from public.reservas
    where (auth.uid() is not null and usuario_id = auth.uid())
       or (auth.uid() is null and sesion_id = p_sesion_id)
  );
$$;

grant execute on function public.es_primera_compra(uuid) to anon, authenticated;