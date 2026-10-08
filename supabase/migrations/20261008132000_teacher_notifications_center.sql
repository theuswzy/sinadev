-- Teacher notifications center and new-delivery alerts.

create or replace function public.student_submit_task_with_attachment(
  _task_id uuid,
  _content text,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  sid uuid;
  sub_id uuid;
  inst uuid;
  due_at timestamptz;
  task_teacher_id uuid;
  task_title text;
  student_name text;
  submit_status text;
  trimmed_content text := trim(coalesce(_content,''));
begin
  if not public.has_role(auth.uid(),'student'::public.app_role) then
    raise exception 'Acesso restrito a alunos.';
  end if;

  if length(trimmed_content)>5000 then
    raise exception 'A resposta pode ter no máximo 5.000 caracteres.';
  end if;

  if nullif(trim(_attachment_path),'') is not null
     and split_part(trim(_attachment_path), '/', 1) <> auth.uid()::text then
    raise exception 'Arquivo de entrega inválido.';
  end if;

  if nullif(trim(_attachment_path),'') is not null
     and split_part(trim(_attachment_path), '/', 2) <> 'submissions' then
    raise exception 'O arquivo precisa pertencer à área de entregas.';
  end if;

  if coalesce(_attachment_size,0) > 20*1024*1024 then
    raise exception 'O arquivo deve ter no máximo 20 MB.';
  end if;

  if trimmed_content='' and nullif(trim(_attachment_path),'') is null then
    raise exception 'Envie uma resposta ou um arquivo.';
  end if;

  inst:=sina_private.current_institution('student'::public.app_role);

  select s.id, s.full_name
    into sid, student_name
  from public.students s
  where s.user_id=auth.uid()
    and s.institution_id=inst
  limit 1;

  if sid is null then
    raise exception 'Perfil de aluno não encontrado.';
  end if;

  select t.due_at, t.teacher_id, t.title
    into due_at, task_teacher_id, task_title
  from public.tasks t
  join public.students s on s.id=sid
  where t.id=_task_id
    and t.institution_id=inst
    and t.classroom_id=s.classroom_id
  limit 1;

  if not found then
    raise exception 'Atividade indisponível para este aluno.';
  end if;

  submit_status := case
    when due_at is not null and now() > due_at then 'submitted_late'
    else 'submitted'
  end;

  insert into public.task_submissions(
    task_id,student_id,content,attachment_path,attachment_name,attachment_size,attachment_type,
    status,submitted_at,updated_at
  )
  values(
    _task_id,sid,trimmed_content,nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),submit_status,now(),now()
  )
  on conflict(task_id,student_id)
  do update set
    content=excluded.content,
    attachment_path=coalesce(excluded.attachment_path,public.task_submissions.attachment_path),
    attachment_name=coalesce(excluded.attachment_name,public.task_submissions.attachment_name),
    attachment_size=case when excluded.attachment_path is null then public.task_submissions.attachment_size else excluded.attachment_size end,
    attachment_type=case when excluded.attachment_path is null then public.task_submissions.attachment_type else excluded.attachment_type end,
    status=excluded.status,
    submitted_at=now(),
    updated_at=now()
  returning id into sub_id;

  insert into public.task_completions(task_id,student_id,completed,updated_at)
  values(_task_id,sid,true,now())
  on conflict(task_id,student_id)
  do update set completed=true,updated_at=now();

  insert into public.notifications(user_id,type,title,body,link,metadata)
  values(
    task_teacher_id,
    case when submit_status='submitted_late' then 'task_submission_late' else 'task_submission' end,
    case when submit_status='submitted_late' then 'Nova entrega em atraso' else 'Nova entrega recebida' end,
    student_name||' enviou uma entrega para "'||coalesce(task_title,'atividade')||'".',
    '/professor/atividades',
    jsonb_build_object(
      'submission_id',sub_id,
      'task_id',_task_id,
      'student_id',sid,
      'student_name',student_name,
      'late',submit_status='submitted_late',
      'institution_id',inst
    )
  );

  return sub_id;
end;
$function$;

create or replace function public.student_submit_task(_task_id uuid, _content text)
returns uuid
language sql
security definer
set search_path to ''
as $function$
  select public.student_submit_task_with_attachment(_task_id,_content,null,null,null,null);
$function$;

create or replace function public.teacher_list_notifications(_unread_only boolean default false, _limit integer default 50)
returns table(
  id uuid,
  user_id uuid,
  type text,
  title text,
  body text,
  link text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select n.id,n.user_id,n.type,n.title,n.body,n.link,n.metadata,n.read_at,n.created_at
  from public.notifications n
  where n.user_id=auth.uid()
    and coalesce((n.metadata->>'institution_id')::uuid, sina_private.current_institution('teacher'::public.app_role))
      = sina_private.current_institution('teacher'::public.app_role)
    and (
      not _unread_only
      or n.read_at is null
    )
  order by n.created_at desc
  limit greatest(1,least(coalesce(_limit,50),100));
$function$;

create or replace function public.teacher_mark_notification_read(_id uuid)
returns boolean
language sql
security definer
set search_path to ''
as $function$
  update public.notifications
     set read_at=coalesce(read_at,now())
   where id=_id
     and user_id=auth.uid()
  returning true;
$function$;

create or replace function public.teacher_mark_all_notifications_read()
returns integer
language sql
security definer
set search_path to ''
as $function$
  with updated as (
    update public.notifications
       set read_at=now()
     where user_id=auth.uid()
       and read_at is null
    returning id
  )
  select count(*)::integer from updated;
$function$;

revoke all on function public.teacher_list_notifications(boolean,integer) from public;
revoke all on function public.teacher_mark_notification_read(uuid) from public;
revoke all on function public.teacher_mark_all_notifications_read() from public;
grant execute on function public.teacher_list_notifications(boolean,integer) to authenticated;
grant execute on function public.teacher_mark_notification_read(uuid) to authenticated;
grant execute on function public.teacher_mark_all_notifications_read() to authenticated;
