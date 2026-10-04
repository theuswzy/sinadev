-- Allow activities to be created/updated without a deadline.
-- This matches the UI's optional "prazo" field and removes the need for
-- unsafe null-to-string TypeScript casts.
create or replace function public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamp with time zone default null,
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
$function$;

create or replace function public.teacher_update_task(
  _id uuid,
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamp with time zone default null,
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
  set classroom=trim(_classroom),
      classroom_id=classroom_id,
      institution_id=inst,
      subject=trim(_subject),
      title=trim(_title),
      description=coalesce(trim(_description),''),
      due_at=_due_at,
      attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),
      attachment_size=_attachment_size,
      attachment_type=nullif(trim(_attachment_type),''),
      updated_at=now()
  where id=_id and teacher_id=auth.uid() and institution_id=inst
  returning * into result_row;

  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$function$;
