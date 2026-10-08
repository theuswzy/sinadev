-- Fix teacher task/announcement mutations to accept UUID values from the current UI
-- and persist normalized classroom/subject names plus subject_id/classroom_id.

create or replace function public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz default null,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.tasks;
  inst uuid;
  classroom_id uuid;
  classroom_name text;
  subject_id uuid;
  subject_name text;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  select c.id, c.name
    into classroom_id, classroom_name
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst
    and c.status='active'
    and (c.id::text=trim(_classroom) or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id::text=trim(_classroom) then 0 else 1 end, c.created_at desc
  limit 1;

  if classroom_id is null then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  select s.id, s.name
    into subject_id, subject_name
  from public.classroom_subjects cs
  join public.subjects s on s.id=cs.subject_id
  where cs.classroom_id=classroom_id
    and cs.institution_id=inst
    and cs.teacher_id=auth.uid()
    and s.institution_id=inst
    and s.status='active'
    and (s.id::text=trim(_subject) or lower(s.name)=lower(trim(_subject)))
  order by case when s.id::text=trim(_subject) then 0 else 1 end, s.name
  limit 1;

  if subject_id is null then
    raise exception 'A disciplina não está vinculada a esta turma para você.';
  end if;

  insert into public.tasks(
    teacher_id,classroom,subject,title,description,due_at,
    attachment_path,attachment_name,attachment_size,attachment_type,
    institution_id,classroom_id,subject_id
  )
  values(
    auth.uid(),classroom_name,subject_name,trim(_title),coalesce(_description,''),_due_at,
    nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),_attachment_size,nullif(trim(_attachment_type),''),
    inst,classroom_id,subject_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),classroom_id,'task',
    'Nova atividade: '||trim(_title),
    coalesce(nullif(trim(_description),''),'Uma nova atividade foi publicada.'),
    '/aluno/tarefas'
  );

  return result_row;
end;
$function$;

create or replace function public.teacher_update_task(
  _id uuid,
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz default null,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.tasks;
  inst uuid;
  classroom_id uuid;
  classroom_name text;
  subject_id uuid;
  subject_name text;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  select c.id, c.name
    into classroom_id, classroom_name
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst
    and c.status='active'
    and (c.id::text=trim(_classroom) or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id::text=trim(_classroom) then 0 else 1 end, c.created_at desc
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  select s.id, s.name
    into subject_id, subject_name
  from public.classroom_subjects cs
  join public.subjects s on s.id=cs.subject_id
  where cs.classroom_id=classroom_id
    and cs.institution_id=inst
    and cs.teacher_id=auth.uid()
    and s.institution_id=inst
    and s.status='active'
    and (s.id::text=trim(_subject) or lower(s.name)=lower(trim(_subject)))
  order by case when s.id::text=trim(_subject) then 0 else 1 end, s.name
  limit 1;

  if subject_id is null then
    raise exception 'A disciplina não está vinculada a esta turma para você.';
  end if;

  update public.tasks
  set classroom=classroom_name,
      classroom_id=classroom_id,
      institution_id=inst,
      subject=subject_name,
      subject_id=subject_id,
      title=trim(_title),
      description=coalesce(trim(_description),''),
      due_at=_due_at,
      attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),
      attachment_size=_attachment_size,
      attachment_type=nullif(trim(_attachment_type),''),
      updated_at=now()
  where id=_id
    and teacher_id=auth.uid()
    and institution_id=inst
  returning * into result_row;

  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$function$;

create or replace function public.teacher_update_announcement(
  _id uuid,
  _classroom text,
  _title text,
  _content text,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.announcements;
  inst uuid;
  classroom_id uuid;
  classroom_name text;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;

  select c.id, c.name
    into classroom_id, classroom_name
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst
    and c.status='active'
    and (c.id::text=trim(_classroom) or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id::text=trim(_classroom) then 0 else 1 end, c.created_at desc
  limit 1;

  if classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  update public.announcements
  set classroom=classroom_name,
      classroom_id=classroom_id,
      institution_id=inst,
      title=trim(_title),
      content=trim(_content),
      attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),
      attachment_size=_attachment_size,
      attachment_type=nullif(trim(_attachment_type),''),
      updated_at=now()
  where id=_id and teacher_id=auth.uid() and institution_id=inst
  returning * into result_row;

  if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
  return result_row;
end;
$function$;
