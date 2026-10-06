-- SINA: enforce current classroom ownership for teacher academic operations.
-- A teacher who loses a classroom must immediately lose access to its
-- submissions and assessments, even when the original record still has
-- teacher_id = auth.uid().

create or replace function public.teacher_list_task_submissions(_task_id uuid)
returns table(
  id uuid,
  task_id uuid,
  student_id uuid,
  student_name text,
  enrollment text,
  content text,
  status text,
  submitted_at timestamptz,
  score numeric,
  feedback text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    ts.id,
    ts.task_id,
    ts.student_id,
    s.full_name,
    s.enrollment,
    ts.content,
    ts.status,
    ts.submitted_at,
    ts.score,
    ts.feedback
  from public.task_submissions ts
  join public.students s on s.id=ts.student_id
  join public.tasks t on t.id=ts.task_id
  where t.id=_task_id
    and t.teacher_id=auth.uid()
    and t.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and s.institution_id=t.institution_id
    and exists (
      select 1
      from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where ct.user_id=auth.uid()
        and c.institution_id=t.institution_id
        and c.status='active'
        and (
          c.id=t.classroom_id
          or (
            t.classroom_id is null
            and lower(c.name)=lower(trim(t.classroom))
          )
        )
    )
  order by s.full_name;
$$;

create or replace function public.teacher_grade_submission(
  _submission_id uuid,
  _score numeric,
  _feedback text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if _score is not null and (_score < 0 or _score > 10) then
    raise exception 'A nota deve estar entre 0 e 10.';
  end if;

  if not exists (
    select 1
    from public.task_submissions ts
    join public.tasks t on t.id=ts.task_id
    join public.students s on s.id=ts.student_id
    where ts.id=_submission_id
      and t.teacher_id=auth.uid()
      and t.institution_id=inst
      and s.institution_id=inst
      and exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.user_id=auth.uid()
          and c.institution_id=inst
          and c.status='active'
          and (
            c.id=t.classroom_id
            or (
              t.classroom_id is null
              and lower(c.name)=lower(trim(t.classroom))
            )
          )
      )
  ) then
    raise exception 'Entrega não pertence a uma turma atualmente vinculada a você.';
  end if;

  update public.task_submissions
  set
    score=_score,
    feedback=nullif(trim(coalesce(_feedback,'')),''),
    status=case when _score is null then 'returned' else 'graded' end,
    graded_at=now(),
    updated_at=now()
  where id=_submission_id;

  return true;
end;
$$;

create or replace function public.teacher_list_assessments(_classroom_id uuid)
returns table(
  id uuid,
  title text,
  assessment_type text,
  weight numeric,
  max_score numeric,
  due_at timestamptz,
  status text,
  subject_id uuid,
  subject_name text,
  term_id uuid,
  term_name text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    a.id,
    a.title,
    a.assessment_type,
    a.weight,
    a.max_score,
    a.due_at,
    a.status,
    a.subject_id,
    coalesce(su.name,''),
    a.term_id,
    coalesce(t.name,'')
  from public.assessments a
  left join public.subjects su on su.id=a.subject_id
  left join public.academic_terms t on t.id=a.term_id
  where a.teacher_id=auth.uid()
    and a.classroom_id=_classroom_id
    and a.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and exists (
      select 1
      from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where ct.classroom_id=a.classroom_id
        and ct.user_id=auth.uid()
        and c.institution_id=a.institution_id
        and c.status='active'
    )
  order by coalesce(a.due_at,a.created_at) desc;
$$;

create or replace function public.teacher_upsert_assessment_score(
  _assessment_id uuid,
  _student_id uuid,
  _score numeric,
  _feedback text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
  max_score numeric;
  assessment_classroom uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  select a.max_score,a.classroom_id
  into max_score,assessment_classroom
  from public.assessments a
  where a.id=_assessment_id
    and a.teacher_id=auth.uid()
    and a.institution_id=inst
    and exists (
      select 1
      from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where ct.classroom_id=a.classroom_id
        and ct.user_id=auth.uid()
        and c.institution_id=inst
        and c.status='active'
    );

  if max_score is null or assessment_classroom is null then
    raise exception 'Avaliação não encontrada ou a turma não está mais vinculada a você.';
  end if;

  if _score is not null and (_score < 0 or _score > max_score) then
    raise exception 'A nota deve estar entre 0 e %.',max_score;
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id=_student_id
      and s.institution_id=inst
      and s.classroom_id=assessment_classroom
  ) then
    raise exception 'Aluno não pertence à turma da avaliação.';
  end if;

  insert into public.assessment_scores(
    assessment_id,
    student_id,
    score,
    feedback,
    graded_at,
    graded_by,
    submitted_at,
    updated_at
  )
  values(
    _assessment_id,
    _student_id,
    _score,
    _feedback,
    now(),
    auth.uid(),
    now(),
    now()
  )
  on conflict(assessment_id,student_id)
  do update set
    score=excluded.score,
    feedback=excluded.feedback,
    graded_at=now(),
    graded_by=auth.uid(),
    updated_at=now();

  return true;
end;
$$;

revoke all on function public.teacher_list_task_submissions(uuid) from public,anon;
revoke all on function public.teacher_grade_submission(uuid,numeric,text) from public,anon;
revoke all on function public.teacher_list_assessments(uuid) from public,anon;
revoke all on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) from public,anon;

grant execute on function public.teacher_list_task_submissions(uuid) to authenticated;
grant execute on function public.teacher_grade_submission(uuid,numeric,text) to authenticated;
grant execute on function public.teacher_list_assessments(uuid) to authenticated;
grant execute on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) to authenticated;
