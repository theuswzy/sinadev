-- SINA: functional hardening for school linking and teacher workflows.
-- This migration closes gaps between the Git repository and the cloud database.

create or replace function public.admin_link_student_to_institution(
  _student_id uuid,
  _institution_id uuid
)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  old_institution uuid;
  student_user uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if not exists (
    select 1 from public.institutions
    where id=_institution_id and status='active'
  ) then
    raise exception 'Escola/instituição inválida ou inativa.';
  end if;

  if not exists (
    select 1 from public.institution_memberships
    where user_id=auth.uid()
      and institution_id=_institution_id
      and role='admin'::public.app_role
      and status='active'
  ) then
    raise exception 'Você não é administrador desta escola.';
  end if;

  select s.user_id,s.institution_id
  into student_user,old_institution
  from public.students s
  where s.id=_student_id
  for update;

  if student_user is null then
    raise exception 'Aluno não encontrado.';
  end if;

  if old_institution is not null and not exists (
    select 1 from public.institution_memberships
    where user_id=auth.uid()
      and institution_id=old_institution
      and role='admin'::public.app_role
      and status='active'
  ) then
    raise exception 'Você não tem permissão para mover este aluno de outra instituição.';
  end if;

  update public.students
  set institution_id=_institution_id,
      classroom_id=null,
      classroom='',
      teacher_id=null,
      updated_at=now()
  where id=_student_id;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(_institution_id,student_user,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user,_institution_id)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$$;

revoke all on function public.admin_link_student_to_institution(uuid,uuid) from public,anon;
grant execute on function public.admin_link_student_to_institution(uuid,uuid) to authenticated;


create or replace function public.teacher_assign_subject_to_class(_subject_id uuid,_classroom_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid; existing_teacher uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if not exists(
    select 1 from public.subjects
    where id=_subject_id and institution_id=inst and status='active'
  ) then
    raise exception 'Disciplina indisponível nesta instituição.';
  end if;

  if not exists(
    select 1
    from public.classrooms c
    join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
    where c.id=_classroom_id and c.institution_id=inst and c.status='active'
  ) then
    raise exception 'A turma não pertence a você.';
  end if;

  select cs.teacher_id into existing_teacher
  from public.classroom_subjects cs
  where cs.classroom_id=_classroom_id and cs.subject_id=_subject_id and cs.institution_id=inst;

  if existing_teacher is not null and existing_teacher<>auth.uid() then
    raise exception 'Esta disciplina já está atribuída a outro professor nesta turma.';
  end if;

  insert into public.classroom_subjects(institution_id,classroom_id,subject_id,teacher_id)
  values(inst,_classroom_id,_subject_id,auth.uid())
  on conflict(classroom_id,subject_id)
  do update set teacher_id=auth.uid()
  returning id into row_id;

  return row_id;
end;
$$;

revoke all on function public.teacher_assign_subject_to_class(uuid,uuid) from public,anon;
grant execute on function public.teacher_assign_subject_to_class(uuid,uuid) to authenticated;


create or replace function public.teacher_update_announcement(
  _id uuid,_classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path=''
as $$
declare result_row public.announcements; inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;

  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active' and lower(c.name)=lower(trim(_classroom))
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  update public.announcements
  set classroom=trim(_classroom),classroom_id=classroom_id,institution_id=inst,
      title=trim(_title),content=trim(_content),
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

revoke all on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) from public,anon;
grant execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) to authenticated;


create or replace function public.teacher_update_task(
  _id uuid,_classroom text,_subject text,_title text,_description text,_due_at timestamptz,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.tasks
language plpgsql security definer set search_path=''
as $$
declare result_row public.tasks; inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;

  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active' and lower(c.name)=lower(trim(_classroom))
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  update public.tasks
  set classroom=trim(_classroom),classroom_id=classroom_id,institution_id=inst,
      subject=trim(_subject),title=trim(_title),description=coalesce(trim(_description),''),
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

revoke all on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
grant execute on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
