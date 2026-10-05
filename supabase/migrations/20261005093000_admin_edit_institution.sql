create or replace function public.admin_update_institution(
  _institution_id uuid,
  _name text,
  _slug text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_ok boolean;
  normalized_slug text;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  if nullif(trim(_name),'') is null or nullif(trim(_slug),'') is null then
    raise exception 'Nome e identificador da instituição são obrigatórios.';
  end if;

  normalized_slug := lower(trim(_slug));

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'O identificador deve usar apenas letras minúsculas, números e hífens.';
  end if;

  select exists(
    select 1
    from public.institution_memberships m
    where m.institution_id = _institution_id
      and m.user_id = auth.uid()
      and m.role = 'admin'::public.app_role
      and m.status = 'active'
  ) into membership_ok;

  if not membership_ok then
    raise exception 'Você não possui acesso administrativo a esta instituição.';
  end if;

  update public.institutions
  set name = trim(_name),
      slug = normalized_slug,
      updated_at = now()
  where id = _institution_id;

  if not found then
    raise exception 'Instituição não encontrada.';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_update_institution(uuid,text,text) from public, anon;
grant execute on function public.admin_update_institution(uuid,text,text) to authenticated;
