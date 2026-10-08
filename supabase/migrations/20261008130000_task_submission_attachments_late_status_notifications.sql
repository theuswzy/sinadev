-- Complete the student submission flow:
-- text and/or file delivery, late-delivery status, and student notification on grading.

drop function if exists public.student_submit_task_with_attachment(uuid,text,text,text,bigint,text);
drop function if exists public.student_list_task_submissions();
drop function if exists public.teacher_grade_submission(uuid,numeric,text);

create function public.student_submit_task_with_attachment(
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

  select s.id into sid
  from public.students s
  where s.user_id=auth.uid()
    and s.institution_id=inst
  limit 1;

  if sid is null then
    raise exception 'Perfil de aluno não encontrado.';
  end if;

  select t.due_at
    into due_at
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

  return sub_id;
end;
$function$;

create function public.student_submit_task(_task_id uuid, _content text)
returns uuid
language sql
security definer
set search_path to ''
as $function$
  select public.student_submit_task_with_attachment(_task_id,_content,null,null,null,null);
$function$;

create function public.student_list_task_submissions()
returns table(
  id uuid,
  task_id uuid,
  content text,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  status text,
  submitted_at timestamptz,
  score numeric,
  feedback text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select ts.id,ts.task_id,ts.content,ts.attachment_path,ts.attachment_name,ts.attachment_size,ts.attachment_type,
         ts.status,ts.submitted_at,ts.score,ts.feedback
  from public.task_submissions ts
  join public.students s on s.id=ts.student_id
  where s.user_id=auth.uid()
  order by ts.submitted_at desc;
$function$;

create function public.teacher_grade_submission(_submission_id uuid,_score numeric,_feedback text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
  student_user_id uuid;
  task_title text;
  task_id uuid;
  new_status text;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if _score is not null and (_score<0 or _score>10) then
    raise exception 'A nota deve estar entre 0 e 10.';
  end if;

  select s.user_id,t.title,t.id
    into student_user_id,task_title,task_id
  from public.task_submissions ts
  join public.tasks t on t.id=ts.task_id
  join public.students s on s.id=ts.student_id
  where ts.id=_submission_id
    and t.teacher_id=auth.uid()
    and t.institution_id=inst
    and s.institution_id=inst
  limit 1;

  if student_user_id is null then
    raise exception 'Entrega não pertence às suas turmas.';
  end if;

  new_status := case when _score is null then 'returned' else 'graded' end;

  update public.task_submissions
  set score=_score,
      feedback=nullif(trim(coalesce(_feedback,'')),''),
      status=new_status,
      graded_at=now(),
      updated_at=now()
  where id=_submission_id;

  insert into public.notifications(user_id,type,title,body,link,metadata)
  values(
    student_user_id,
    case when _score is null then 'task_returned' else 'task_graded' end,
    case when _score is null then 'Entrega devolvida' else 'Atividade corrigida' end,
    case
      when _score is null then 'Sua entrega em "'||coalesce(task_title,'atividade')||'" foi devolvida para revisão.'
      else 'Sua atividade "'||coalesce(task_title,'atividade')||'" foi corrigida. Nota: '||to_char(_score,'FM990D00')||'.'
    end,
    '/aluno/tarefas',
    jsonb_build_object('submission_id',_submission_id,'task_id',task_id)
  );

  return true;
end;
$function$;

grant execute on function public.student_submit_task_with_attachment(uuid,text,text,text,bigint,text) to authenticated;
grant execute on function public.student_submit_task(uuid,text) to authenticated;
grant execute on function public.student_list_task_submissions() to authenticated;
grant execute on function public.teacher_grade_submission(uuid,numeric,text) to authenticated;
