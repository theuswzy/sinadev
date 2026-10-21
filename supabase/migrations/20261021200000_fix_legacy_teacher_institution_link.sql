-- Ensure legacy admin teacher-access changes also create the institutional link.
-- Without this, the teacher role exists globally but teacher RPCs cannot resolve a school.
create or replace function public.admin_set_teacher_access(_email text, _enabled boolean)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  target_user uuid;
  inst uuid;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    return false;
  end if;

  select id into target_user
  from auth.users
  where lower(email) = lower(trim(_email))
  limit 1;

  if target_user is null then
    return false;
  end if;

  if _enabled then
    inst := sina_private.current_institution('admin'::public.app_role);
    if inst is null then
      raise exception 'Nenhuma instituição administrativa ativa encontrada.';
    end if;

    insert into public.user_roles (user_id, role)
    values (target_user, 'teacher'::public.app_role)
    on conflict (user_id, role) do nothing;

    insert into public.institution_memberships(institution_id,user_id,role,status)
    values(inst,target_user,'teacher'::public.app_role,'active')
    on conflict(institution_id,user_id,role)
    do update set status='active',updated_at=now();

    insert into public.user_institution_context(user_id,institution_id)
    values(target_user,inst)
    on conflict(user_id)
    do update set institution_id=excluded.institution_id,updated_at=now();
  else
    delete from public.user_roles
    where user_id = target_user and role = 'teacher'::public.app_role;
    delete from public.institution_memberships
    where user_id=target_user and role='teacher'::public.app_role;
  end if;

  return true;
end
$function$;

revoke all on function public.admin_set_teacher_access(text, boolean) from public, anon;
grant execute on function public.admin_set_teacher_access(text, boolean) to authenticated;
