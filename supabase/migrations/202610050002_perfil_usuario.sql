create or replace function public.actualizar_perfil_usuario(
  p_nombre text,
  p_apellido text,
  p_fecha_nacimiento date,
  p_tipo_sangre text,
  p_color_ojos text
)
returns public.perfiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  perfil_actualizado public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión para actualizar el perfil.';
  end if;

  update public.perfiles
  set nombre = p_nombre,
      apellido = p_apellido,
      fecha_nacimiento = p_fecha_nacimiento,
      tipo_sangre = p_tipo_sangre,
      color_ojos = p_color_ojos
  where id = auth.uid()
  returning * into perfil_actualizado;

  if not found then
    raise exception 'No se encontró el perfil del usuario autenticado.';
  end if;

  return perfil_actualizado;
end;
$$;

revoke all on function public.actualizar_perfil_usuario(text, text, date, text, text) from public, anon;
grant execute on function public.actualizar_perfil_usuario(text, text, date, text, text) to authenticated;