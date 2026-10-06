-- Fix ambiguous PL/pgSQL variable/column references in teacher publishing RPCs.
-- Keep the canonical signatures used by the frontend and qualify all classroom ids.

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
language plpgsql
security definer
set search_path=''
as $$
declare
  result_row public.tasks;
  v_inst uuid;
  v_classroom_id uuid;
  v_subject_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  if nullif(trim(_classroom),'') is null then
    raise exception 'Selecione uma turma.';
  end if;

  if nullif(trim(_subject),'') is null then
    raise exception 'Informe a disciplina.';
  end if;

  if nullif(trim(_title),'') is null then
    raise exception 'Informe o título da atividade.';
  end if;

  select c.id
    into v_classroom_id
  from public.classrooms as c
  join public.classroom_teachers as ct
    on ct.classroom_id = c.id
   and ct.user_id = auth.uid()
  where c.institution_id = v_inst
    and c.status = 'active'
    and lower(c.name) = lower(trim(_classroom))
  limit 1;

  if v_classroom_id is null then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  select s.id
    into v_subject_id
  from public.subjects as s
  where s.institution_id = v_inst
    and s.status = 'active'
    and lower(s.name) = lower(trim(_subject))
  limit 1;

  if v_subject_id is null then
    raise exception 'A disciplina não está disponível nesta instituição.';
  end if;

  -- When classroom_subjects exists, require the teacher's selected subject
  -- to be assigned to that classroom. This preserves multi-class isolation.
  if to_regclass('public.classroom_subjects') is not null
     and not exists (
       select 1
       from public.classroom_subjects as cs
       where cs.classroom_id = v_classroom_id
         and cs.subject_id = v_subject_id
     ) then
    raise exception 'A disciplina não está vinculada à turma selecionada.';
  end if;

  insert into public.tasks(
    teacher_id,
    classroom,
    subject,
    title,
    description,
    due_at,
    attachment_path,
    attachment_name,
    attachment_size,
    attachment_type,
    institution_id,
    classroom_id
  )
  values(
    auth.uid(),
    trim(_classroom),
    trim(_subject),
    trim(_title),
    coalesce(_description,''),
    _due_at,
    nullif(trim(_attachment_path),''),
    nullif(trim(_attachment_name),''),
    _attachment_size,
    nullif(trim(_attachment_type),''),
    v_inst,
    v_classroom_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),
    v_classroom_id,
    'task',
    'Nova atividade: ' || trim(_title),
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
language plpgsql
security definer
set search_path=''
as $$
declare
  result_row public.announcements;
  v_inst uuid;
  v_classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  if nullif(trim(_classroom),'') is null then
    raise exception 'Selecione uma turma.';
  end if;

  if nullif(trim(_title),'') is null then
    raise exception 'Informe o título do aviso.';
  end if;

  if nullif(trim(_content),'') is null then
    raise exception 'Escreva o conteúdo do aviso.';
  end if;

  select c.id
    into v_classroom_id
  from public.classrooms as c
  join public.classroom_teachers as ct
    on ct.classroom_id = c.id
   and ct.user_id = auth.uid()
  where c.institution_id = v_inst
    and c.status = 'active'
    and lower(c.name) = lower(trim(_classroom))
  limit 1;

  if v_classroom_id is null then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  insert into public.announcements(
    teacher_id,
    classroom,
    title,
    content,
    attachment_path,
    attachment_name,
    attachment_size,
    attachment_type,
    institution_id,
    classroom_id
  )
  values(
    auth.uid(),
    trim(_classroom),
    trim(_title),
    trim(_content),
    nullif(trim(_attachment_path),''),
    nullif(trim(_attachment_name),''),
    _attachment_size,
    nullif(trim(_attachment_type),''),
    v_inst,
    v_classroom_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),
    v_classroom_id,
    'announcement',
    trim(_title),
    coalesce(nullif(trim(_content),''),'Novo aviso publicado.'),
    '/aluno/avisos'
  );

  return result_row;
end;
$$;

revoke all on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public,anon;

grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
