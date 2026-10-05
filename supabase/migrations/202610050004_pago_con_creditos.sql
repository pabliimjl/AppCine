alter table public.movimientos_creditos
  drop constraint if exists movimientos_creditos_reserva_id_key,
  drop constraint if exists movimientos_creditos_tipo_check,
  drop constraint if exists movimientos_creditos_reserva_tipo_key,
  add constraint movimientos_creditos_tipo_check
    check (tipo in ('devolucion', 'compra')),
  add constraint movimientos_creditos_reserva_tipo_key
    unique (reserva_id, tipo);

create or replace function public.comprar_con_creditos(
  p_funcion_id uuid,
  p_sesion_id uuid,
  p_butacas jsonb,
  p_items_candy jsonb,
  p_total_esperado numeric,
  p_codigo_cupon text,
  p_fecha_nacimiento date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_precio_base numeric(12, 2);
  v_total_entradas numeric(12, 2) := 0;
  v_total_candy numeric(12, 2) := 0;
  v_subtotal numeric(12, 2);
  v_descuento_cupon numeric(12, 2) := 0;
  v_descuento_edad numeric(12, 2) := 0;
  v_descuento numeric(12, 2) := 0;
  v_tipo_descuento text;
  v_total_final numeric(12, 2);
  v_saldo numeric(12, 2);
  v_nuevo_saldo numeric(12, 2);
  v_total_asientos integer;
  v_asientos_unicos integer;
  v_bloqueos integer;
  v_cantidad integer;
  v_stock integer;
  v_precio_item numeric(12, 2);
  v_item jsonb;
  v_candy_normalizado jsonb := '[]'::jsonb;
  v_reserva_id uuid;
  v_config public.configuracion_descuentos%rowtype;
  v_tipo_entrada text;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para pagar con créditos.';
  end if;
  if jsonb_typeof(p_butacas) <> 'array' or jsonb_array_length(p_butacas) = 0 then
    raise exception 'Selecciona al menos una butaca.';
  end if;
  if jsonb_typeof(coalesce(p_items_candy, '[]'::jsonb)) <> 'array' then
    raise exception 'El carrito de Candy no es válido.';
  end if;

  select creditos into v_saldo
  from public.perfiles
  where id = auth.uid()
  for update;
  if not found then
    raise exception 'No se encontró el perfil de esta cuenta.';
  end if;

  select coalesce(
    case when pelicula.fecha_estreno > current_date
      then pelicula.precio_preventa
      else pelicula.precio_base
    end,
    pelicula.precio_base
  )
  into v_precio_base
  from public.funciones funcion
  join public.peliculas pelicula on pelicula.id = funcion.pelicula_id
  where funcion.id::text = p_funcion_id::text;
  if not found or v_precio_base is null or v_precio_base < 0 then
    raise exception 'No se encontró el precio de esta función.';
  end if;

  select count(*), count(distinct elemento.value->>'id')
  into v_total_asientos, v_asientos_unicos
  from jsonb_array_elements(p_butacas) elemento(value);
  if v_total_asientos <> v_asientos_unicos then
    raise exception 'La selección contiene butacas duplicadas.';
  end if;

  select count(*) into v_bloqueos
  from jsonb_array_elements(p_butacas) elemento(value)
  join public.butacas_bloqueadas bloqueo
    on bloqueo.butaca_id::text = elemento.value->>'id'
     and bloqueo.funcion_id::text = p_funcion_id::text
     and bloqueo.sesion_id::text = p_sesion_id::text
   and bloqueo.expira_en > now();
  if v_bloqueos <> v_total_asientos then
    raise exception 'Una o más butacas ya no están reservadas para esta sesión. Vuelve a seleccionarlas.';
  end if;

  for v_item in select elemento.value from jsonb_array_elements(p_butacas) elemento(value)
  loop
    v_tipo_entrada := v_item->>'tipo';
    if v_tipo_entrada = 'regular' then
      v_total_entradas := v_total_entradas + v_precio_base;
    elsif v_tipo_entrada = 'accesible' then
      v_total_entradas := v_total_entradas + v_precio_base * 0.5;
    elsif v_tipo_entrada = 'vip' then
      v_total_entradas := v_total_entradas + v_precio_base * 1.5;
    else
      raise exception 'El tipo de butaca no es válido.';
    end if;
  end loop;

  for v_item in select elemento.value from jsonb_array_elements(coalesce(p_items_candy, '[]'::jsonb)) elemento(value)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad < 1 or v_cantidad > 50 then
      raise exception 'La cantidad de un producto no es válida.';
    end if;

    if v_item->>'tipo' = 'producto' then
      select precio, stock into v_precio_item, v_stock
      from public.candy_productos
      where id = (v_item->>'id')::uuid
      for update;
      if not found or v_stock < v_cantidad then
        raise exception 'Un producto de Candy ya no tiene stock suficiente.';
      end if;
      update public.candy_productos
      set stock = stock - v_cantidad
      where id = (v_item->>'id')::uuid;
    elsif v_item->>'tipo' = 'combo' then
      select precio_combo into v_precio_item
      from public.candy_combos
      where id = (v_item->>'id')::uuid
      for share;
      if not found then
        raise exception 'Un combo de Candy ya no está disponible.';
      end if;
    else
      raise exception 'El tipo de producto de Candy no es válido.';
    end if;

    v_total_candy := v_total_candy + v_precio_item * v_cantidad;
    v_candy_normalizado := v_candy_normalizado || jsonb_build_array(jsonb_build_object(
      'id', v_item->>'id',
      'tipo', v_item->>'tipo',
      'cantidad', v_cantidad,
      'precio', v_precio_item
    ));
  end loop;

  v_subtotal := v_total_entradas + v_total_candy;
  select * into v_config
  from public.configuracion_descuentos
  where id = true;

  if p_codigo_cupon is not null and length(trim(p_codigo_cupon)) > 0 then
    if not coalesce(v_config.primera_compra_activa, false)
      or upper(trim(p_codigo_cupon)) <> upper(trim(v_config.codigo_primera_compra)) then
      raise exception 'El cupón no es válido o ya no está activo.';
    end if;
    if exists (select 1 from public.reservas where usuario_id = auth.uid()) then
      raise exception 'El cupón de primera compra ya fue utilizado.';
    end if;
    v_descuento_cupon := round(v_subtotal * v_config.descuento_primera_compra / 100, 0);
  end if;

  if coalesce(v_config.mayores_50_activo, false)
    and p_fecha_nacimiento is not null
    and p_fecha_nacimiento <= current_date
    and extract(year from age(current_date, p_fecha_nacimiento)) >= v_config.edad_minima then
    v_descuento_edad := round(v_total_entradas * v_config.descuento_mayores_50 / 100, 0);
  end if;

  if v_descuento_cupon >= v_descuento_edad and v_descuento_cupon > 0 then
    v_descuento := v_descuento_cupon;
    v_tipo_descuento := 'primera_compra';
  elsif v_descuento_edad > 0 then
    v_descuento := v_descuento_edad;
    v_tipo_descuento := 'mayores_50';
  end if;

  v_total_final := greatest(0, round(v_subtotal - v_descuento, 0));
  if p_total_esperado is null or abs(p_total_esperado - v_total_final) > 0.01 then
    raise exception 'El total cambió. Actualiza el checkout antes de pagar.';
  end if;
  if v_saldo < v_total_final then
    raise exception 'Créditos insuficientes. Saldo disponible: %.', v_saldo;
  end if;

  insert into public.reservas (
    funcion_id,
    total,
    metodo_pago,
    usuario_id,
    sesion_id,
    entradas_compradas,
    descuento,
    tipo_descuento,
    codigo_cupon
  ) values (
    p_funcion_id,
    v_total_final,
    'creditos',
    auth.uid(),
    p_sesion_id,
    v_total_asientos,
    v_descuento,
    v_tipo_descuento,
    case when v_tipo_descuento = 'primera_compra' then upper(trim(p_codigo_cupon)) else null end
  ) returning id into v_reserva_id;

  insert into public.reserva_asientos (reserva_id, butaca_id, tipo)
  select v_reserva_id, elemento.value->>'id', elemento.value->>'tipo'
  from jsonb_array_elements(p_butacas) elemento(value);

  for v_item in select elemento.value from jsonb_array_elements(v_candy_normalizado) elemento(value)
  loop
    insert into public.reserva_candy (reserva_id, item_id, tipo_item, cantidad, precio)
    values (
      v_reserva_id,
      (v_item->>'id')::uuid,
      v_item->>'tipo',
      (v_item->>'cantidad')::integer,
      (v_item->>'precio')::numeric
    );
  end loop;

  update public.perfiles
  set creditos = creditos - v_total_final
  where id = auth.uid()
  returning creditos into v_nuevo_saldo;

  if v_total_final > 0 then
    insert into public.movimientos_creditos (usuario_id, reserva_id, tipo, importe)
    values (auth.uid(), v_reserva_id, 'compra', v_total_final);
  end if;

  delete from public.butacas_bloqueadas
  where sesion_id::text = p_sesion_id::text;

  return jsonb_build_object(
    'reserva_id', v_reserva_id,
    'total', v_total_final,
    'descuento', v_descuento,
    'tipo_descuento', v_tipo_descuento,
    'saldo_creditos', v_nuevo_saldo
  );
end;
$$;

revoke all on function public.comprar_con_creditos(uuid, uuid, jsonb, jsonb, numeric, text, date) from public, anon;
grant execute on function public.comprar_con_creditos(uuid, uuid, jsonb, jsonb, numeric, text, date) to authenticated;
