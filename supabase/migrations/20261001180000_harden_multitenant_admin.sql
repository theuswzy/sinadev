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


-- Scope academic role changes to the active institution. Global role rows are
-- retained when the user still needs that role in another institution.
create or replace function sina_private.set_academic_role(_user_id uuid,_role text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_institution uuid;
  old_role public.app_role;
  v_status text;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  if v_institution is null then
    raise exception 'Administrador sem instituição ativa.';
  end if;

  if _role not in ('student','teacher') then
    raise exception 'Função acadêmica inválida.';
  end if;

  if not exists(select 1 from auth.users where id=_user_id) then
    return false;
  end if;

  if exists(
    select 1 from public.institution_memberships
    where user_id=_user_id
      and institution_id=v_institution
      and role='admin'
      and status='active'
  ) then
    raise exception 'A função acadêmica de um administrador não pode ser alterada nesta tela.';
  end if;

  select m.role into old_role
  from public.institution_memberships m
  where m.user_id=_user_id
    and m.institution_id=v_institution
    and m.role in ('student','teacher')
  order by case when m.role='teacher' then 0 else 1 end
  limit 1;

  v_status := coalesce(
    (select p.status from public.profiles p where p.user_id=_user_id limit 1),
    'active'
  );

  delete from public.institution_memberships
  where user_id=_user_id
    and institution_id=v_institution
    and role in ('student','teacher');

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(v_institution,_user_id,_role::public.app_role,v_status);

  insert into public.user_roles(user_id,role)
  values(_user_id,_role::public.app_role)
  on conflict(user_id,role) do nothing;

  if old_role is not null and old_role::text <> _role
     and not exists(
       select 1 from public.institution_memberships
       where user_id=_user_id
         and role=old_role
         and status='active'
     ) then
    delete from public.user_roles
    where user_id=_user_id and role=old_role;
  end if;

  if _role='student' then
    perform public.ensure_student_profile_for_user(_user_id,v_institution);
  end if;

  return true;
end;
$$;

revoke all on function sina_private.set_academic_role(uuid,text) from public,anon;
grant execute on function sina_private.set_academic_role(uuid,text) to authenticated;

-- Teacher communication management must respect the active institution too.
create or replace function public.teacher_list_announcements()
returns setof public.announcements
language sql
security definer
set search_path to ''
as $$
  select a.*
  from public.announcements a
  where a.teacher_id=auth.uid()
    and a.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by a.created_at desc
  limit 100;
$$;

create or replace function public.teacher_list_tasks()
returns setof public.tasks
language sql
security definer
set search_path to ''
as $$
  select t.*
  from public.tasks t
  where t.teacher_id=auth.uid()
    and t.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by t.created_at desc
  limit 100;
$$;

create or replace function public.teacher_update_announcement(
  _id uuid,_classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $$
declare result_row public.announcements; inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;
  if not exists(
    select 1 from public.classrooms c
    join public.classroom_teachers ct on ct.classroom_id=c.id
    where c.institution_id=inst and c.status='active'
      and ct.user_id=auth.uid()
      and lower(c.name)=lower(trim(_classroom))
  ) then raise exception 'A turma selecionada não pertence a você.'; end if;

  update public.announcements
  set classroom=trim(_classroom),title=trim(_title),content=trim(_content),
      attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),
      attachment_size=_attachment_size,attachment_type=nullif(trim(_attachment_type),''),
      updated_at=now()
  where id=_id and teacher_id=auth.uid() and institution_id=inst
  returning * into result_row;

  if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
  return result_row;
end;
$$;

create or replace function public.teacher_delete_announcement(_id uuid)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $$
declare result_row public.announcements;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  delete from public.announcements
  where id=_id and teacher_id=auth.uid()
    and institution_id=sina_private.current_institution('teacher'::public.app_role)
  returning * into result_row;
  if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
  return result_row;
end;
$$;

create or replace function public.teacher_update_task(
  _id uuid,_classroom text,_subject text,_title text,_description text,_due_at timestamptz,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $$
declare result_row public.tasks; inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;
  if not exists(
    select 1 from public.classrooms c
    join public.classroom_teachers ct on ct.classroom_id=c.id
    where c.institution_id=inst and c.status='active'
      and ct.user_id=auth.uid()
      and lower(c.name)=lower(trim(_classroom))
  ) then raise exception 'A turma selecionada não pertence a você.'; end if;

  update public.tasks
  set classroom=trim(_classroom),subject=trim(_subject),title=trim(_title),
      description=coalesce(trim(_description),''),
      due_at=_due_at,attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),
      attachment_size=_attachment_size,attachment_type=nullif(trim(_attachment_type),''),
      updated_at=now()
  where id=_id and teacher_id=auth.uid() and institution_id=inst
  returning * into result_row;

  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$$;

create or replace function public.teacher_delete_task(_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $$
declare result_row public.tasks;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  delete from public.tasks
  where id=_id and teacher_id=auth.uid()
    and institution_id=sina_private.current_institution('teacher'::public.app_role)
  returning * into result_row;
  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$$;

-- Student task/announcement RPCs also enforce the student's institution.
create or replace function public.student_list_announcements()
returns setof public.announcements
language sql
security definer
set search_path to ''
as $$
  select a.*
  from public.announcements a
  join public.students s
    on s.user_id=auth.uid()
   and s.institution_id=a.institution_id
   and s.teacher_id=a.teacher_id
   and s.classroom=a.classroom
  order by a.created_at desc
  limit 30;
$$;

create or replace function public.student_list_tasks()
returns table (
  id uuid,classroom text,subject text,title text,description text,
  due_at timestamptz,created_at timestamptz,completed boolean
)
language sql
security definer
set search_path to ''
as $$
  select t.id,t.classroom,t.subject,t.title,t.description,t.due_at,t.created_at,
         coalesce(tc.completed,false)
  from public.tasks t
  join public.students s
    on s.user_id=auth.uid()
   and s.institution_id=t.institution_id
   and s.teacher_id=t.teacher_id
   and s.classroom=t.classroom
  left join public.task_completions tc
    on tc.task_id=t.id and tc.student_id=s.id
  order by (t.due_at is null),t.due_at,t.created_at desc
  limit 50;
$$;

create or replace function public.student_set_task_completed(_task_id uuid,_completed boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare student_record public.students;
begin
  select s.* into student_record
  from public.students s
  where s.user_id=auth.uid()
  limit 1;

  if student_record.id is null then raise exception 'Perfil de aluno não encontrado.'; end if;

  if not exists(
    select 1 from public.tasks t
    where t.id=_task_id
      and t.institution_id=student_record.institution_id
      and t.teacher_id=student_record.teacher_id
      and t.classroom=student_record.classroom
      and student_record.teacher_id is not null
  ) then raise exception 'Tarefa não encontrada para este aluno.'; end if;

  insert into public.task_completions(task_id,student_id,completed,updated_at)
  values(_task_id,student_record.id,_completed,now())
  on conflict(task_id,student_id)
  do update set completed=excluded.completed,updated_at=now();

  return true;
end;
$$;

revoke all on function public.teacher_list_announcements() from public,anon;
revoke all on function public.teacher_list_tasks() from public,anon;
revoke all on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_delete_announcement(uuid) from public,anon;
revoke all on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_delete_task(uuid) from public,anon;
revoke all on function public.student_list_announcements() from public,anon;
revoke all on function public.student_list_tasks() from public,anon;
revoke all on function public.student_set_task_completed(uuid,boolean) from public,anon;

grant execute on function public.teacher_list_announcements() to authenticated;
grant execute on function public.teacher_list_tasks() to authenticated;
grant execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_delete_announcement(uuid) to authenticated;
grant execute on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_delete_task(uuid) to authenticated;
grant execute on function public.student_list_announcements() to authenticated;
grant execute on function public.student_list_tasks() to authenticated;
grant execute on function public.student_set_task_completed(uuid,boolean) to authenticated;


-- Keep catalog provenance honest for municipal entries imported from the
-- public 2023 municipal list used during the initial directory bootstrap.
update public.school_directory
set source='SMED/UNICEF',
    source_year=2023,
    updated_at=now()
where municipality='Salvador'
  and network_type='municipal'
  and source='Prefeitura de Salvador'
  and source_year=2026;


-- Fix direct grade entry and classroom discovery so every write is institution-scoped.
create or replace function public.teacher_upsert_grade(
  _student_id uuid,
  _subject text,
  _period integer,
  _score numeric,
  _absences integer
)
returns public.grades
language plpgsql
security definer
set search_path to ''
as $$
declare
  result_row public.grades;
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if _period < 1 or _period > 4 or _score < 0 or _score > 10 or _absences < 0 then
    raise exception 'Dados da nota inválidos.';
  end if;

  if not exists(
    select 1
    from public.students s
    where s.id=_student_id
      and s.teacher_id=auth.uid()
      and s.institution_id=inst
  ) then
    raise exception 'Aluno não vinculado a este professor nesta instituição.';
  end if;

  insert into public.grades(student_id,subject,period,score,absences,institution_id)
  values(_student_id,trim(_subject),_period,_score,_absences,inst)
  on conflict(student_id,subject,period)
  do update set score=excluded.score,absences=excluded.absences,
                institution_id=excluded.institution_id,updated_at=now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.teacher_upsert_grade(uuid,text,integer,numeric,integer) from public,anon;
grant execute on function public.teacher_upsert_grade(uuid,text,integer,numeric,integer) to authenticated;

create or replace function public.teacher_list_classrooms()
returns table(id uuid,name text,code text,status text,student_count bigint)
language sql stable security definer set search_path to ''
as $$
  select c.id,c.name,c.code,c.status,count(s.id)::bigint
  from public.classrooms c
  join public.classroom_teachers ct
    on ct.classroom_id=c.id
   and ct.user_id=auth.uid()
  left join public.students s
    on s.classroom_id=c.id
   and s.teacher_id=auth.uid()
   and s.institution_id=c.institution_id
  where c.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and c.status='active'
  group by c.id
  order by c.name;
$$;

revoke all on function public.teacher_list_classrooms() from public,anon;
grant execute on function public.teacher_list_classrooms() to authenticated;

-- A rejected request keeps its selected school when the user resubmits.
create or replace function public.account_resubmit_role_request(_requested_role text)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  uid uuid:=auth.uid();
  v_school uuid;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if _requested_role not in ('student','teacher') then raise exception 'Função solicitada inválida.'; end if;
  if exists(
    select 1 from public.user_roles r
    where r.user_id=uid and r.role in ('admin','teacher','student')
  ) then
    return false;
  end if;

  select school_directory_id into v_school
  from public.account_role_requests
  where user_id=uid
  order by created_at desc
  limit 1;

  update public.account_role_requests
  set status='cancelled',updated_at=now()
  where user_id=uid and status='pending';

  insert into public.account_role_requests(
    user_id,requested_role,status,school_directory_id
  )
  values(uid,_requested_role::public.app_role,'pending',v_school);

  update public.profiles
  set status='pending',updated_at=now()
  where user_id=uid;

  return true;
end;
$$;

revoke all on function public.account_resubmit_role_request(text) from public,anon;
grant execute on function public.account_resubmit_role_request(text) to authenticated;


create or replace function public.teacher_create_announcement(
  _classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path to ''
as $$
declare result_row public.announcements; inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active' and lower(c.name)=lower(trim(_classroom))
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  insert into public.announcements(
    teacher_id,classroom,title,content,attachment_path,attachment_name,
    attachment_size,attachment_type,institution_id,classroom_id
  )
  values(
    auth.uid(),trim(_classroom),trim(_title),trim(_content),
    nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),inst,classroom_id
  )
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.teacher_create_task(
  _classroom text,_subject text,_title text,_description text,_due_at timestamptz,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.tasks
language plpgsql security definer set search_path to ''
as $$
declare result_row public.tasks; inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active' and lower(c.name)=lower(trim(_classroom))
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  insert into public.tasks(
    teacher_id,classroom,subject,title,description,due_at,
    attachment_path,attachment_name,attachment_size,attachment_type,
    institution_id,classroom_id
  )
  values(
    auth.uid(),trim(_classroom),trim(_subject),trim(_title),coalesce(trim(_description),''),
    _due_at,nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),inst,classroom_id
  )
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.student_list_tasks()
returns table(
  id uuid,classroom text,subject text,title text,description text,due_at timestamptz,
  attachment_path text,attachment_name text,attachment_size bigint,attachment_type text,
  created_at timestamptz,completed boolean
)
language sql stable security definer set search_path to ''
as $$
  select t.id,t.classroom,t.subject,t.title,t.description,t.due_at,
         t.attachment_path,t.attachment_name,t.attachment_size,t.attachment_type,
         t.created_at,coalesce(tc.completed,false)
  from public.tasks t
  join public.students s
    on s.user_id=auth.uid()
   and s.institution_id=t.institution_id
   and s.classroom_id=t.classroom_id
  left join public.task_completions tc
    on tc.task_id=t.id and tc.student_id=s.id
  order by coalesce(t.due_at,t.created_at) asc
  limit 100;
$$;

create or replace function public.student_set_task_completed(_task_id uuid,_completed boolean)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare student_id_var uuid; inst uuid;
begin
  select s.id,s.institution_id into student_id_var,inst
  from public.students s
  where s.user_id=auth.uid()
  limit 1;

  if student_id_var is null or inst is null then
    raise exception 'Perfil de aluno não encontrado.';
  end if;

  if not exists(
    select 1
    from public.tasks t
    join public.students s on s.id=student_id_var
      and s.institution_id=t.institution_id
      and s.classroom_id=t.classroom_id
    where t.id=_task_id and t.institution_id=inst
  ) then
    raise exception 'Tarefa não disponível para este aluno.';
  end if;

  insert into public.task_completions(task_id,student_id,completed,updated_at)
  values(_task_id,student_id_var,_completed,now())
  on conflict(task_id,student_id)
  do update set completed=excluded.completed,updated_at=now();

  return true;
end;
$$;

revoke all on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
revoke all on function public.student_list_tasks() from public,anon;
revoke all on function public.student_set_task_completed(uuid,boolean) from public,anon;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.student_list_tasks() to authenticated;
grant execute on function public.student_set_task_completed(uuid,boolean) to authenticated;


-- New accounts must not receive an academic role before approval.
-- The original signup trigger assigned "student" automatically, which made
-- pending accounts look authorized and blocked role resubmission.
create or replace function public.new_account()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles(user_id,display_name,status)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',''),
    'pending'
  )
  on conflict(user_id) do nothing;

  return new;
end;
$$;

-- Remove the legacy automatic student role only from accounts still pending.
delete from public.user_roles r
using public.profiles p
where p.user_id=r.user_id
  and p.status='pending'
  and r.role in ('student','teacher');

create or replace function public.account_resubmit_role_request(_requested_role text)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  uid uuid:=auth.uid();
  v_school uuid;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if _requested_role not in ('student','teacher') then
    raise exception 'Função solicitada inválida.';
  end if;

  -- A role without an active institution membership is not an approved role.
  if exists(
    select 1
    from public.institution_memberships m
    where m.user_id=uid
      and m.role in ('admin','teacher','student')
      and m.status='active'
  ) then
    return false;
  end if;

  select school_directory_id into v_school
  from public.account_role_requests
  where user_id=uid
  order by created_at desc
  limit 1;

  update public.account_role_requests
  set status='cancelled',updated_at=now()
  where user_id=uid and status='pending';

  insert into public.account_role_requests(
    user_id,requested_role,status,school_directory_id
  )
  values(uid,_requested_role::public.app_role,'pending',v_school);

  update public.profiles
  set status='pending',updated_at=now()
  where user_id=uid;

  -- Ensure stale pre-approval roles cannot authorize access.
  delete from public.user_roles
  where user_id=uid
    and role in ('student','teacher')
    and not exists(
      select 1
      from public.institution_memberships m
      where m.user_id=uid
        and m.role=user_roles.role
        and m.status='active'
    );

  return true;
end;
$$;

revoke all on function public.new_account() from public,anon,authenticated;
revoke all on function public.account_resubmit_role_request(text) from public,anon;
grant execute on function public.account_resubmit_role_request(text) to authenticated;


-- Approval changes only the membership in the selected institution.
-- Global roles are the union of active institution memberships.
create or replace function public.admin_review_role_request_v2(
  _request_id uuid,_decision text,_approved_role text,_note text
)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  req public.account_role_requests;
  school public.school_directory;
  inst uuid;
  admin_inst uuid;
  old_role public.app_role;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  admin_inst := sina_private.current_institution('admin'::public.app_role);
  if admin_inst is null then raise exception 'Administrador sem instituição ativa.'; end if;
  if _decision not in ('approved','rejected') then raise exception 'Decisão inválida.'; end if;

  select * into req from public.account_role_requests where id=_request_id for update;
  if req.id is null then return false; end if;
  if req.status<>'pending' then raise exception 'Esta solicitação já foi processada.'; end if;

  select * into school
  from public.school_directory
  where id=req.school_directory_id and status='active';

  if school.id is null then raise exception 'A escola selecionada não está mais disponível no catálogo.'; end if;

  select coalesce(req.institution_id,school.institution_id) into inst;

  if inst is null or inst<>admin_inst then
    raise exception 'Esta solicitação não pertence à instituição ativa.';
  end if;

  if _decision='rejected' then
    update public.account_role_requests
    set institution_id=admin_inst,status='rejected',reviewed_by=auth.uid(),
        reviewed_at=now(),review_note=nullif(trim(_note),''),updated_at=now()
    where id=_request_id;

    update public.profiles set status='pending',updated_at=now()
    where user_id=req.user_id;
    return true;
  end if;

  if _approved_role not in ('student','teacher') then
    raise exception 'Selecione uma função válida para aprovar.';
  end if;

  select m.role into old_role
  from public.institution_memberships m
  where m.user_id=req.user_id
    and m.institution_id=admin_inst
    and m.role in ('student','teacher')
    and m.status='active'
  limit 1;

  delete from public.institution_memberships
  where user_id=req.user_id
    and institution_id=admin_inst
    and role in ('student','teacher');

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(admin_inst,req.user_id,_approved_role::public.app_role,'active');

  insert into public.user_roles(user_id,role)
  values(req.user_id,_approved_role::public.app_role)
  on conflict(user_id,role) do nothing;

  if old_role is not null
     and old_role::text<>_approved_role
     and not exists(
       select 1 from public.institution_memberships
       where user_id=req.user_id
         and role=old_role
         and status='active'
     ) then
    delete from public.user_roles
    where user_id=req.user_id and role=old_role;
  end if;

  update public.account_role_requests
  set institution_id=admin_inst,status='approved',reviewed_by=auth.uid(),
      reviewed_at=now(),review_note=nullif(trim(_note),''),updated_at=now()
  where id=_request_id;

  update public.profiles set status='active',updated_at=now()
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
