-- Final teacher workflow authorization hardening.
create or replace function public.student_submit_task(_task_id uuid, _content text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare sid uuid; sub_id uuid; inst uuid;
begin
  if not public.has_role(auth.uid(),'student'::public.app_role) then raise exception 'Acesso restrito a alunos.'; end if;
  inst:=sina_private.current_institution('student'::public.app_role);
  select s.id into sid from public.students s where s.user_id=auth.uid() and s.institution_id=inst limit 1;
  if sid is null then raise exception 'Perfil de aluno não encontrado.'; end if;
  if not exists(
    select 1 from public.tasks t
    join public.students s on s.id=sid
    where t.id=_task_id and t.institution_id=inst and t.classroom_id=s.classroom_id
  ) then raise exception 'Atividade indisponível para este aluno.'; end if;
  insert into public.task_submissions(task_id,student_id,content,status,submitted_at,updated_at)
  values(_task_id,sid,coalesce(_content,''),'submitted',now(),now())
  on conflict(task_id,student_id) do update
  set content=excluded.content,status='submitted',submitted_at=now(),updated_at=now();
  select id into sub_id from public.task_submissions where task_id=_task_id and student_id=sid;
  return sub_id;
end;
$$;

create or replace function public.teacher_list_task_submissions(_task_id uuid)
returns table(id uuid,task_id uuid,student_id uuid,student_name text,enrollment text,content text,status text,submitted_at timestamptz,score numeric,feedback text)
language sql stable security definer set search_path=''
as $$
 select ts.id,ts.task_id,ts.student_id,s.full_name,s.enrollment,ts.content,ts.status,ts.submitted_at,ts.score,ts.feedback
 from public.task_submissions ts
 join public.students s on s.id=ts.student_id
 join public.tasks t on t.id=ts.task_id
 where t.id=_task_id
   and t.teacher_id=auth.uid()
   and t.institution_id=sina_private.current_institution('teacher'::public.app_role)
   and s.institution_id=t.institution_id
 order by s.full_name;
$$;

create or replace function public.teacher_grade_submission(_submission_id uuid,_score numeric,_feedback text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if _score is not null and (_score < 0 or _score > 10) then raise exception 'A nota deve estar entre 0 e 10.'; end if;
  if not exists(
    select 1 from public.task_submissions ts
    join public.tasks t on t.id=ts.task_id
    join public.students s on s.id=ts.student_id
    where ts.id=_submission_id and t.teacher_id=auth.uid()
      and t.institution_id=inst and s.institution_id=inst
  ) then raise exception 'Entrega não pertence às suas turmas.'; end if;
  update public.task_submissions
  set score=_score,feedback=nullif(trim(coalesce(_feedback,'')),''),status=case when _score is null then 'returned' else 'graded' end,graded_at=now(),updated_at=now()
  where id=_submission_id;
  return true;
end;
$$;

create or replace function public.teacher_upsert_assessment_score(
  _assessment_id uuid,_student_id uuid,_score numeric,_feedback text
)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid; max_score numeric;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  select a.max_score into max_score from public.assessments a where a.id=_assessment_id and a.teacher_id=auth.uid() and a.institution_id=inst;
  if max_score is null then raise exception 'Avaliação não encontrada ou não pertence a você.'; end if;
  if _score is not null and (_score < 0 or _score > max_score) then raise exception 'A nota deve estar entre 0 e %.',max_score; end if;
  if not exists(select 1 from public.students s join public.assessments a on a.classroom_id=s.classroom_id where s.id=_student_id and a.id=_assessment_id and s.institution_id=inst) then
    raise exception 'Aluno não pertence à turma da avaliação.';
  end if;
  insert into public.assessment_scores(assessment_id,student_id,score,feedback,graded_at,graded_by,submitted_at,updated_at)
  values(_assessment_id,_student_id,_score,_feedback,now(),auth.uid(),now(),now())
  on conflict(assessment_id,student_id) do update
  set score=excluded.score,feedback=excluded.feedback,graded_at=now(),graded_by=auth.uid(),updated_at=now();
  return true;
end;
$$;

revoke all on function public.student_submit_task(uuid,text) from public,anon;
revoke all on function public.teacher_list_task_submissions(uuid) from public,anon;
revoke all on function public.teacher_grade_submission(uuid,numeric,text) from public,anon;
revoke all on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.student_submit_task(uuid,text) to authenticated;
grant execute on function public.teacher_list_task_submissions(uuid) to authenticated;
grant execute on function public.teacher_grade_submission(uuid,numeric,text) to authenticated;
grant execute on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) to authenticated;
