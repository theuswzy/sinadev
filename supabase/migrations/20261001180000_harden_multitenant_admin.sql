-- SINA: harden multi-institution administration and school onboarding

drop function if exists public.admin_create_institution(text,text);
-- Every administrative operation below is scoped to the administrator's active institution.

create or replace function public.admin_create_institution(
  _name text,
  _slug text,
  _school_directory_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_school public.school_directory;
begin
  if not public.has_role(uid,'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if nullif(trim(_name),'') is null or nullif(trim(_slug),'') is null then
    raise exception 'Nome e identificador da instituição são obrigatórios.';
  end if;

  if _school_directory_id is not null then
    select * into v_school
    from public.school_directory
    where id = _school_directory_id
      and status = 'active'
    for update;

    if v_school.id is null then
      raise exception 'Escola inválida ou indisponível.';
    end if;

    if v_school.institution_id is not null then
      insert into public.institution_memberships(institution_id,user_id,role,status)
      values(v_school.institution_id,uid,'admin'::public.app_role,'active')
      on conflict(institution_id,user_id,role) do update set status='active',updated_at=now();

      insert into public.user_institution_context(user_id,institution_id)
      values(uid,v_school.institution_id)
      on conflict(user_id) do update
        set institution_id=excluded.institution_id,updated_at=now();

      return v_school.institution_id;
    end if;
  end if;

  insert into public.institutions(name,slug,status,school_directory_id)
  values(trim(_name),lower(trim(_slug)),'active',_school_directory_id)
  returning id into v_id;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(v_id,uid,'admin'::public.app_role,'active')
  on conflict(institution_id,user_id,role) do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(uid,v_id)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id,updated_at=now();

  if _school_directory_id is not null then
    update public.school_directory
    set institution_id=v_id,updated_at=now()
    where id=_school_directory_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_create_institution(text,text,uuid) from public,anon;
grant execute on function public.admin_create_institution(text,text,uuid) to authenticated;

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
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_institution uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  if v_institution is null then
    raise exception 'Administrador sem instituição ativa.';
  end if;

  return query
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
  where coalesce(rr.institution_id,d.institution_id) = v_institution
  order by case when rr.status='pending' then 0 else 1 end, rr.created_at desc;
end;
$$;

revoke all on function public.admin_list_role_requests_v2() from public,anon;
grant execute on function public.admin_list_role_requests_v2() to authenticated;

create or replace function public.admin_review_role_request_v2(
  _request_id uuid,
  _decision text,
  _approved_role text,
  _note text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  req public.account_role_requests;
  school public.school_directory;
  inst uuid;
  admin_inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  admin_inst := sina_private.current_institution('admin'::public.app_role);
  if admin_inst is null then
    raise exception 'Administrador sem instituição ativa.';
  end if;

  if _decision not in ('approved','rejected') then
    raise exception 'Decisão inválida.';
  end if;

  select * into req
  from public.account_role_requests
  where id=_request_id
  for update;

  if req.id is null then return false; end if;
  if req.status <> 'pending' then
    raise exception 'Esta solicitação já foi processada.';
  end if;

  select * into school
  from public.school_directory
  where id=req.school_directory_id
    and status='active';

  if school.id is null then
    raise exception 'A escola selecionada não está mais disponível no catálogo.';
  end if;

  inst := coalesce(req.institution_id,school.institution_id);

  if inst is null then
    raise exception 'Esta escola ainda não está vinculada a uma instituição SINA. Cadastre ou vincule a escola antes de aprovar.';
  end if;

  if inst <> admin_inst then
    raise exception 'Esta solicitação pertence a outra instituição.';
  end if;

  if _decision='rejected' then
    update public.account_role_requests
    set status='rejected',
        institution_id=admin_inst,
        reviewed_by=auth.uid(),
        reviewed_at=now(),
        review_note=nullif(trim(_note),''),
        updated_at=now()
    where id=_request_id;

    update public.profiles
    set status='pending',updated_at=now()
    where user_id=req.user_id;

    return true;
  end if;

  if _approved_role not in ('student','teacher') then
    raise exception 'Selecione uma função válida para aprovar.';
  end if;

  delete from public.user_roles
  where user_id=req.user_id
    and role in ('student','teacher');

  insert into public.user_roles(user_id,role)
  values(req.user_id,_approved_role::public.app_role);

  delete from public.institution_memberships
  where user_id=req.user_id
    and role in ('student','teacher')
    and institution_id=admin_inst;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(admin_inst,req.user_id,_approved_role::public.app_role,'active');

  update public.account_role_requests
  set institution_id=admin_inst,
      status='approved',
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      review_note=nullif(trim(_note),''),
      updated_at=now()
  where id=_request_id;

  update public.profiles
  set status='active',updated_at=now()
  where user_id=req.user_id;

  update public.school_directory
  set institution_id=admin_inst,updated_at=now()
  where id=school.id;

  if _approved_role='student' then
    perform public.ensure_student_profile_for_user(req.user_id,admin_inst);
  end if;

  return true;
end;
$$;

revoke all on function public.admin_review_role_request_v2(uuid,text,text,text) from public,anon;
grant execute on function public.admin_review_role_request_v2(uuid,text,text,text) to authenticated;

create or replace function sina_private.list_accounts()
returns table (
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
set search_path to ''
as $$
declare
  v_institution uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  if v_institution is null then
    raise exception 'Administrador sem instituição ativa.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.display_name,'')::text,
    coalesce(
      (
        select case when m.role='teacher' then 'teacher' when m.role='student' then 'student' else 'admin' end
        from public.institution_memberships m
        where m.user_id=u.id
          and m.institution_id=v_institution
          and m.status='active'
        order by case when m.role='admin' then 0 when m.role='teacher' then 1 else 2 end
        limit 1
      ),
      'student'
    )::text,
    exists(
      select 1 from public.institution_memberships m
      where m.user_id=u.id
        and m.institution_id=v_institution
        and m.role='admin'
        and m.status='active'
    ),
    coalesce(p.status,'active')
  from auth.users u
  join public.institution_memberships membership
    on membership.user_id=u.id
   and membership.institution_id=v_institution
   and membership.status='active'
  left join public.profiles p on p.user_id=u.id
  group by u.id,u.email,p.display_name,p.status
  order by coalesce(nullif(p.display_name,''),u.email),u.email;
end;
$$;

create or replace function sina_private.set_account_status(_user_id uuid,_status text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_institution uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  if v_institution is null then
    raise exception 'Administrador sem instituição ativa.';
  end if;

  if _status not in ('active','pending','suspended') then
    raise exception 'Status de conta inválido.';
  end if;
  if _user_id=auth.uid() then
    raise exception 'A própria conta administrativa não pode ser suspensa.';
  end if;

  if not exists(
    select 1
    from public.institution_memberships m
    where m.user_id=_user_id
      and m.institution_id=v_institution
      and m.status='active'
  ) then
    raise exception 'A conta não pertence à instituição ativa.';
  end if;

  if exists(
    select 1
    from public.institution_memberships m
    where m.user_id=_user_id
      and m.institution_id=v_institution
      and m.role='admin'
      and m.status='active'
  ) then
    raise exception 'Contas administrativas não podem ser suspensas nesta tela.';
  end if;

  update public.profiles
  set status=_status,updated_at=now()
  where user_id=_user_id;

  update public.institution_memberships
  set status=case when _status='suspended' then 'suspended' else 'active' end,
      updated_at=now()
  where user_id=_user_id
    and institution_id=v_institution;

  return found;
end;
$$;

revoke all on function sina_private.list_accounts() from public,anon;
grant execute on function sina_private.list_accounts() to authenticated;
revoke all on function public.admin_list_accounts() from public,anon;
grant execute on function public.admin_list_accounts() to authenticated;

-- Correct search normalization for the Salvador catalog.
update public.school_directory
set normalized_name=lower(name)
where municipality='Salvador'
  and normalized_name is distinct from lower(name);
