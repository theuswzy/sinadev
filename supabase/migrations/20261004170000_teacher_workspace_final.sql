-- SINA: final teacher workspace authorization and functional workflow.
-- Teachers have broad academic-management permissions inside their active institution,
-- but never receive administrator/site-owner privileges.

-- The previous teacher_workspace migration attempted to GRANT old 5/3-argument
-- signatures after replacing them with functions that have defaulted attachment
-- parameters. PostgreSQL function identity includes all parameters, so that GRANT
-- could abort the migration. This migration installs the canonical signatures
-- and grants the exact functions used by the frontend.

alter table public.subjects
  add column if not exists created_by uuid references auth.users(id);

create or replace function public.teacher_list_subjects()
returns table(id uuid,name text,code text,status text,created_by uuid)
language sql stable security definer set search_path=''
as $$
  select s.id,s.name,s.code,s.status,s.created_by
  from public.subjects s
  where s.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and s.status='active'
  order by lower(s.name);
$$;

create or replace function public.teacher_create_subject(_name text,_code text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_name),'') is null then raise exception 'Informe o nome da disciplina.'; end if;

  if exists (
    select 1 from public.subjects
    where institution_id=inst and status='active'
      and lower(name)=lower(trim(_name))
  ) then
    raise exception 'Já existe uma disciplina com esse nome nesta instituição.';
  end if;

  insert into public.subjects(institution_id,name,code,status,created_by)
  values(inst,trim(_name),nullif(trim(_code),''),'active',auth.uid())
  returning id into row_id;
  return row_id;
end;
$$;

create or replace function public.teacher_update_subject(_id uuid,_name text,_code text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if nullif(trim(_name),'') is null then raise exception 'Informe o nome da disciplina.'; end if;

  update public.subjects
  set name=trim(_name),code=nullif(trim(_code),''),updated_at=now()
  where id=_id and institution_id=inst and created_by=auth.uid() and status='active';

  if not found then raise exception 'Disciplina não encontrada ou não pertence a você.'; end if;
  return true;
end;
$$;

create or replace function public.teacher_archive_subject(_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);

  update public.subjects
  set status='archived',updated_at=now()
  where id=_id and institution_id=inst and created_by=auth.uid() and status='active';

  return found;
end;
$$;

-- A single canonical enrollment operation. It can link an unassigned student
-- to the teacher's current school and classroom in one action. It can also move
-- a student between classrooms owned by the same teacher. It cannot move a
-- student from another institution or silently take another teacher's class.
create or replace function public.teacher_enroll_student_in_classroom(
  _student_id uuid,
  _classroom_id uuid,
  _enrollment text
)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  inst uuid;
  student_inst uuid;
  student_user uuid;
  current_classroom uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_enrollment),'') is null then raise exception 'Informe a matrícula.'; end if;

  if not exists (
    select 1
    from public.classrooms c
    join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
    where c.id=_classroom_id and c.institution_id=inst and c.status='active'
  ) then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  select s.user_id,s.institution_id,s.classroom_id
  into student_user,student_inst,current_classroom
  from public.students s
  where s.id=_student_id
  for update;

  if student_user is null then raise exception 'Aluno não encontrado.'; end if;

  if student_inst is not null and student_inst<>inst then
    raise exception 'Este aluno pertence a outra instituição.';
  end if;

  if current_classroom is not null
     and current_classroom<>_classroom_id
     and not exists (
       select 1 from public.classroom_teachers
       where classroom_id=current_classroom and user_id=auth.uid()
     ) then
    raise exception 'Este aluno já está em uma turma de outro professor. Solicite a mudança ao administrador.';
  end if;

  update public.students
  set institution_id=inst,
      classroom_id=_classroom_id,
      classroom=(select c.name from public.classrooms c where c.id=_classroom_id),
      enrollment=trim(_enrollment),
      teacher_id=auth.uid(),
      updated_at=now()
  where id=_student_id;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,student_user,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user,inst)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$$;

-- Teacher publishing is explicitly scoped to the teacher's active institution
-- and classroom ownership. This is the academic equivalent of admin CRUD, not
-- global site administration.
create or replace function public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.tasks
language plpgsql security definer set search_path=''
as $$
declare result_row public.tasks; inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active'
    and lower(c.name)=lower(trim(_classroom))
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  if not exists (
    select 1 from public.subjects s
    where s.institution_id=inst and s.status='active'
      and lower(s.name)=lower(trim(_subject))
  ) then
    raise exception 'A disciplina não está disponível nesta instituição.';
  end if;

  insert into public.tasks(
    teacher_id,classroom,subject,title,description,due_at,
    attachment_path,attachment_name,attachment_size,attachment_type,
    institution_id,classroom_id
  )
  values(
    auth.uid(),trim(_classroom),trim(_subject),trim(_title),coalesce(_description,''),
    _due_at,nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),inst,classroom_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),classroom_id,'task','Nova atividade: '||trim(_title),
    coalesce(nullif(trim(_description),''),'Uma nova atividade foi publicada.'),
    '/aluno/tarefas'
  );

  return result_row;
end;
$$;

create or replace function public.teacher_create_announcement(
  _classroom text,
  _title text,
  _content text,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path=''
as $$
declare result_row public.announcements; inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active'
    and lower(c.name)=lower(trim(_classroom))
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

  perform sina_private.create_classroom_notifications(
    auth.uid(),classroom_id,'announcement',trim(_title),
    coalesce(nullif(trim(_content),''),'Novo aviso publicado.'),
    '/aluno/avisos'
  );

  return result_row;
end;
$$;

create or replace function public.teacher_list_tasks()
returns setof public.tasks
language sql stable security definer set search_path=''
as $$
  select t.*
  from public.tasks t
  where t.teacher_id=auth.uid()
    and t.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by t.created_at desc
  limit 100;
$$;

create or replace function public.teacher_list_announcements()
returns setof public.announcements
language sql stable security definer set search_path=''
as $$
  select a.*
  from public.announcements a
  where a.teacher_id=auth.uid()
    and a.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by a.created_at desc
  limit 100;
$$;

-- Correct student visibility by institution + classroom id. This prevents two
-- schools from seeing content merely because two classes share the same name.
create or replace function public.student_list_tasks()
returns table (
  id uuid,classroom text,subject text,title text,description text,due_at timestamptz,
  attachment_path text,attachment_name text,attachment_size bigint,attachment_type text,
  created_at timestamptz,completed boolean
)
language sql security definer set search_path=''
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
  where t.institution_id=sina_private.current_institution('student'::public.app_role)
  order by coalesce(t.due_at,t.created_at) asc
  limit 100;
$$;

create or replace function public.student_list_announcements()
returns table (
  id uuid,teacher_id uuid,classroom text,title text,content text,
  attachment_path text,attachment_name text,attachment_size bigint,attachment_type text,
  created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path=''
as $$
  select a.id,a.teacher_id,a.classroom,a.title,a.content,
         a.attachment_path,a.attachment_name,a.attachment_size,a.attachment_type,
         a.created_at,a.updated_at
  from public.announcements a
  join public.students s
    on s.user_id=auth.uid()
   and s.institution_id=a.institution_id
   and s.classroom_id=a.classroom_id
  where a.institution_id=sina_private.current_institution('student'::public.app_role)
  order by a.created_at desc
  limit 100;
$$;

revoke all on function public.teacher_list_subjects() from public,anon;
revoke all on function public.teacher_create_subject(text,text) from public,anon;
revoke all on function public.teacher_update_subject(uuid,text,text) from public,anon;
revoke all on function public.teacher_archive_subject(uuid) from public,anon;
revoke all on function public.teacher_enroll_student_in_classroom(uuid,uuid,text) from public,anon;
revoke all on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_list_tasks() from public,anon;
revoke all on function public.teacher_list_announcements() from public,anon;
revoke all on function public.student_list_tasks() from public,anon;
revoke all on function public.student_list_announcements() from public,anon;

grant execute on function public.teacher_list_subjects() to authenticated;
grant execute on function public.teacher_create_subject(text,text) to authenticated;
grant execute on function public.teacher_update_subject(uuid,text,text) to authenticated;
grant execute on function public.teacher_archive_subject(uuid) to authenticated;
grant execute on function public.teacher_enroll_student_in_classroom(uuid,uuid,text) to authenticated;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_list_tasks() to authenticated;
grant execute on function public.teacher_list_announcements() to authenticated;
grant execute on function public.student_list_tasks() to authenticated;
grant execute on function public.student_list_announcements() to authenticated;
