-- Allow an institution administrator to permanently delete an institution.
-- Only institution-scoped academic data is removed; auth.users are never deleted.
create or replace function public.admin_delete_institution(_institution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_ok boolean;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso restrito ao administrador.';
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

  delete from public.announcements where institution_id = _institution_id;
  delete from public.grades where institution_id = _institution_id;
  delete from public.tasks where institution_id = _institution_id;
  delete from public.students where institution_id = _institution_id;

  delete from public.institutions where id = _institution_id;

  if not found then
    raise exception 'Instituição não encontrada.';
  end if;

  return true;
end;
$$;

revoke all on function public.admin_delete_institution(uuid) from public, anon;
grant execute on function public.admin_delete_institution(uuid) to authenticated;
