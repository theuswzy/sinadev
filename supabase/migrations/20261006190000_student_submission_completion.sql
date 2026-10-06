-- Keep task completion state consistent with a real submission.
-- Sending/updating an assignment is an explicit completion signal for the student.

create or replace function public.student_submit_task(_task_id uuid,_content text)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  sid uuid;
  sub_id uuid;
  inst uuid;
begin
  if not public.has_role(auth.uid(),'student'::public.app_role) then
    raise exception 'Acesso restrito a alunos.';
  end if;

  if length(coalesce(_content,''))>5000 then
    raise exception 'A resposta pode ter no máximo 5.000 caracteres.';
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

  if not exists(
    select 1
    from public.tasks t
    join public.students s on s.id=sid
    where t.id=_task_id
      and t.institution_id=inst
      and t.classroom_id=s.classroom_id
  ) then
    raise exception 'Atividade indisponível para este aluno.';
  end if;

  insert into public.task_submissions(
    task_id,student_id,content,status,submitted_at,updated_at
  )
  values(
    _task_id,sid,coalesce(_content,''),'submitted',now(),now()
  )
  on conflict(task_id,student_id)
  do update set
    content=excluded.content,
    status='submitted',
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

revoke execute on function public.student_submit_task(uuid,text) from public,anon;
grant execute on function public.student_submit_task(uuid,text) to authenticated;
