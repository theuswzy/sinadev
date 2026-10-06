-- SINA: tenant-safe admin operations and complete realtime synchronization.
-- Admin operations must stay inside the currently selected institution.
-- Realtime publication must include every academic table the shell subscribes to.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'user_roles',
    'account_role_requests',
    'institution_invitations',
    'grades',
    'attendance_records',
    'tasks',
    'task_submissions',
    'task_completions',
    'announcements',
    'assessments',
    'assessment_scores',
    'academic_materials',
    'calendar_events',
    'notifications',
    'classrooms',
    'subjects',
    'academic_terms',
    'classroom_subjects',
    'classroom_teachers',
    'students',
    'audit_logs'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;

create or replace function sina_private.list_accounts()
returns table(
  user_id uuid,
  email text,
  display_name text,
  academic_role text,
  is_administrator boolean,
  account_status text
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  inst:=sina_private.current_institution('admin'::public.app_role);
  if inst is null then
    raise exception 'Nenhuma instituição administrativa ativa encontrada.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.display_name,'')::text,
    case
      when exists (
        select 1 from public.institution_memberships m
        where m.user_id=u.id and m.institution_id=inst
          and m.role='teacher'::public.app_role
      ) then 'teacher'
      else 'student'
    end::text,
    exists (
      select 1 from public.institution_memberships m
      where m.user_id=u.id and m.institution_id=inst
        and m.role='admin'::public.app_role
        and m.status='active'
    ),
    coalesce(p.status,'active')
  from auth.users u
  left join public.profiles p on p.user_id=u.id
  where exists (
    select 1
    from public.institution_memberships m
    where m.user_id=u.id
      and m.institution_id=inst
  )
  order by coalesce(nullif(p.display_name,''),u.email),u.email;
end;
$function$;

create or replace function public.admin_list_teachers()
returns table(user_id uuid,email text,display_name text,created_at timestamptz)
language sql
stable
security definer
set search_path=''
as $function$
  select
    u.id,
    u.email::text,
    coalesce(p.display_name,''),
    u.created_at
  from auth.users u
  join public.institution_memberships m
    on m.user_id=u.id
   and m.institution_id=sina_private.current_institution('admin'::public.app_role)
   and m.role='teacher'::public.app_role
   and m.status='active'
  left join public.profiles p on p.user_id=u.id
  order by coalesce(p.display_name,''),u.email
$function$;

create or replace function public.admin_list_role_requests_v2()
returns table(
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  requested_role text,
  status text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz,
  school_directory_id uuid,
  school_name text,
  school_network_type text
)
language sql
stable
security definer
set search_path=''
as $function$
  select
    rr.id,
    rr.user_id,
    au.email::text,
    coalesce(p.display_name,''),
    rr.requested_role::text,
    rr.status,
    rr.review_note,
    rr.created_at,
    rr.reviewed_at,
    rr.school_directory_id,
    d.name,
    d.network_type
  from public.account_role_requests rr
  join auth.users au on au.id=rr.user_id
  left join public.profiles p on p.user_id=rr.user_id
  left join public.school_directory d on d.id=rr.school_directory_id
  join public.institutions i
    on i.school_directory_id=rr.school_directory_id
   and i.id=sina_private.current_institution('admin'::public.app_role)
  order by case when rr.status='pending' then 0 else 1 end,rr.created_at desc;
$function$;

create or replace function sina_private.list_admin_audit_logs(_limit integer default 100)
returns setof public.audit_logs
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  inst:=sina_private.current_institution('admin'::public.app_role);
  if inst is null then
    raise exception 'Nenhuma instituição administrativa ativa encontrada.';
  end if;

  return query
  select a.*
  from public.audit_logs a
  where exists (
    select 1
    from public.institution_memberships m
    where m.user_id=a.actor_user_id
      and m.institution_id=inst
      and m.role='admin'::public.app_role
  )
  or coalesce(a.old_data->>'institution_id',a.new_data->>'institution_id')=inst::text
  order by a.created_at desc
  limit greatest(1,least(coalesce(_limit,100),250));
end;
$function$;

create or replace function sina_private.set_account_status(_user_id uuid,_status text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if _status not in ('active','pending','suspended') then
    raise exception 'Status de conta inválido.';
  end if;

  if _user_id=auth.uid() then
    raise exception 'A própria conta administrativa não pode ser suspensa.';
  end if;

  if public.has_role(_user_id,'admin'::public.app_role) then
    raise exception 'Contas administrativas não podem ser suspensas nesta tela.';
  end if;

  inst:=sina_private.current_institution('admin'::public.app_role);
  if inst is null then
    raise exception 'Nenhuma instituição administrativa ativa encontrada.';
  end if;

  if not exists (
    select 1 from public.institution_memberships m
    where m.user_id=_user_id and m.institution_id=inst
  ) then
    raise exception 'A conta não pertence à instituição administrativa ativa.';
  end if;

  if (
    select count(*)
    from public.institution_memberships m
    where m.user_id=_user_id
      and m.status='active'
  ) > 1 then
    raise exception 'Esta conta pertence a mais de uma escola. A suspensão global deve ser feita pelo controle central da conta.';
  end if;

  update public.profiles
     set status=_status,
         updated_at=now()
   where user_id=_user_id;

  update public.institution_memberships
     set status=case when _status='suspended' then 'suspended' else 'active' end,
         updated_at=now()
   where user_id=_user_id
     and institution_id=inst;

  return found;
end;
$function$;

create or replace function sina_private.delete_account(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  inst uuid;
  target_email text;
  target_name text;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if _user_id is null or _user_id=auth.uid() then
    raise exception 'Conta inválida ou não pode excluir a própria conta.';
  end if;

  if public.has_role(_user_id,'admin'::public.app_role) then
    raise exception 'Contas administrativas não podem ser excluídas por esta tela.';
  end if;

  inst:=sina_private.current_institution('admin'::public.app_role);
  if inst is null then
    raise exception 'Nenhuma instituição administrativa ativa encontrada.';
  end if;

  if not exists (
    select 1 from public.institution_memberships m
    where m.user_id=_user_id and m.institution_id=inst
  ) then
    raise exception 'A conta não pertence à instituição administrativa ativa.';
  end if;

  if (
    select count(*)
    from public.institution_memberships m
    where m.user_id=_user_id
      and m.status='active'
  ) > 1 then
    raise exception 'A conta está vinculada a mais de uma escola. Remova os vínculos escolares antes de excluir a conta globalmente.';
  end if;

  select coalesce(au.email::text,''),coalesce(p.display_name,'')
    into target_email,target_name
  from auth.users au
  left join public.profiles p on p.user_id=au.id
  where au.id=_user_id
  limit 1;

  if target_email is null then
    raise exception 'Conta não encontrada.';
  end if;

  insert into public.audit_logs(action,table_name,record_id,actor_user_id,old_data,new_data)
  values(
    'DELETE','auth.users',_user_id,auth.uid(),
    jsonb_build_object('email',target_email,'display_name',target_name,'institution_id',inst),
    null
  );

  delete from public.academic_materials where created_by=_user_id;
  update public.subjects set created_by=null where created_by=_user_id;
  update public.students set teacher_id=null where teacher_id=_user_id;
  delete from public.students where user_id=_user_id;
  delete from auth.users where id=_user_id;

  return true;
end;
$function$;

revoke execute on function public.admin_list_role_requests_v2() from public,anon;
grant execute on function public.admin_list_role_requests_v2() to authenticated;
revoke execute on function public.admin_list_teachers() from public,anon;
grant execute on function public.admin_list_teachers() to authenticated;
revoke execute on function public.admin_list_accounts() from public,anon;
grant execute on function public.admin_list_accounts() to authenticated;
revoke execute on function public.admin_list_audit_logs(integer) from public,anon;
grant execute on function public.admin_list_audit_logs(integer) to authenticated;
