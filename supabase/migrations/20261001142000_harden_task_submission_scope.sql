create or replace function public.student_submit_task(_task_id uuid, _content text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare sid uuid; sub_id uuid; student_classroom uuid; student_institution uuid;
begin
  select id, classroom_id, institution_id into sid, student_classroom, student_institution
  from public.students where user_id=auth.uid() limit 1;
  if sid is null then raise exception 'Perfil de aluno não encontrado'; end if;
  if not exists(
    select 1 from public.tasks t
    where t.id=_task_id
      and t.institution_id=student_institution
      and t.classroom_id=student_classroom
  ) then
    raise exception 'Atividade indisponível';
  end if;
  insert into public.task_submissions(task_id,student_id,content,status,submitted_at,updated_at)
  values(_task_id,sid,coalesce(_content,''),'submitted',now(),now())
  on conflict(task_id,student_id) do update
  set content=excluded.content,status='submitted',submitted_at=now(),updated_at=now();
  select id into sub_id from public.task_submissions where task_id=_task_id and student_id=sid;
  return sub_id;
end;
$$;
revoke all on function public.student_submit_task(uuid,text) from public, anon;
grant execute on function public.student_submit_task(uuid,text) to authenticated;
