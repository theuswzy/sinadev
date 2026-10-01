-- Admin teacher/classroom assignment.
create or replace function public.admin_list_teacher_classroom_assignments()
returns table(classroom_id uuid,classroom_name text,teacher_id uuid,teacher_name text,teacher_email text)
language sql stable security definer set search_path=''
as $$
  select c.id,c.name,u.id,coalesce(p.display_name,''),u.email
  from public.classroom_teachers ct
  join public.classrooms c on c.id=ct.classroom_id
  join auth.users u on u.id=ct.user_id
  left join public.profiles p on p.user_id=u.id
  where c.institution_id=sina_private.current_institution('admin'::public.app_role)
    and c.status='active'
    and public.has_role(u.id,'teacher'::public.app_role)
  order by c.name,coalesce(p.display_name,u.email);
$$;

create or replace function public.admin_list_institution_teachers()
returns table(user_id uuid,display_name text,email text)
language sql stable security definer set search_path=''
as $$
  select u.id,coalesce(p.display_name,''),u.email
  from auth.users u
  left join public.profiles p on p.user_id=u.id
  join public.institution_memberships m on m.user_id=u.id
  where m.institution_id=sina_private.current_institution('admin'::public.app_role)
    and m.status='active'
    and public.has_role(u.id,'teacher'::public.app_role)
  order by coalesce(p.display_name,u.email);
$$;

create or replace function public.admin_assign_teacher_to_classroom(_teacher_id uuid,_classroom_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito a administradores.'; end if;
  inst:=sina_private.current_institution('admin'::public.app_role);
  if not exists(select 1 from public.classrooms where id=_classroom_id and institution_id=inst and status='active') then raise exception 'Turma não encontrada na instituição ativa.'; end if;
  if not exists(select 1 from public.institution_memberships m where m.user_id=_teacher_id and m.institution_id=inst and m.status='active') then raise exception 'Professor não pertence à instituição ativa.'; end if;
  if not public.has_role(_teacher_id,'teacher'::public.app_role) then raise exception 'A conta selecionada não é professor.'; end if;
  insert into public.classroom_teachers(classroom_id,user_id) values(_classroom_id,_teacher_id) on conflict(classroom_id,user_id) do nothing;
  return true;
end;
$$;

create or replace function public.admin_unassign_teacher_from_classroom(_teacher_id uuid,_classroom_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito a administradores.'; end if;
  inst:=sina_private.current_institution('admin'::public.app_role);
  delete from public.classroom_teachers ct using public.classrooms c
  where ct.classroom_id=c.id and ct.user_id=_teacher_id and c.id=_classroom_id and c.institution_id=inst;
  return found;
end;
$$;

revoke all on function public.admin_list_teacher_classroom_assignments() from public,anon;
revoke all on function public.admin_list_institution_teachers() from public,anon;
revoke all on function public.admin_assign_teacher_to_classroom(uuid,uuid) from public,anon;
revoke all on function public.admin_unassign_teacher_from_classroom(uuid,uuid) from public,anon;
grant execute on function public.admin_list_teacher_classroom_assignments() to authenticated;
grant execute on function public.admin_list_institution_teachers() to authenticated;
grant execute on function public.admin_assign_teacher_to_classroom(uuid,uuid) to authenticated;
grant execute on function public.admin_unassign_teacher_from_classroom(uuid,uuid) to authenticated;