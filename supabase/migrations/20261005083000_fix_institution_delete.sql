-- Fix institution deletion workflow: the current administrator's own membership
-- must not block deletion. Populated institutions remain protected from hard deletion.

create or replace function public.admin_delete_institution(_institution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership_ok boolean;
  blockers text[];
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

  select array_remove(array[
    case when exists(select 1 from public.students s where s.institution_id = _institution_id) then 'alunos' end,
    case when exists(select 1 from public.grades g where g.institution_id = _institution_id) then 'notas' end,
    case when exists(select 1 from public.tasks t where t.institution_id = _institution_id) then 'atividades' end,
    case when exists(select 1 from public.announcements a where a.institution_id = _institution_id) then 'avisos' end,
    case when exists(
      select 1
      from public.institution_memberships m
      where m.institution_id = _institution_id
        and not (
          m.user_id = auth.uid()
          and m.role = 'admin'::public.app_role
        )
    ) then 'usuários vinculados' end
  ], null) into blockers;

  if coalesce(array_length(blockers, 1), 0) > 0 then
    raise exception
      'A escola possui dados vinculados: %. Use "Desativar" para preservar o histórico.',
      array_to_string(blockers, ', ');
  end if;

  delete from public.institutions
  where id = _institution_id;

  return found;
end;
$$;

revoke all on function public.admin_delete_institution(uuid) from public, anon;
grant execute on function public.admin_delete_institution(uuid) to authenticated;
