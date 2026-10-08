create or replace function public.teacher_list_task_submissions(_task_id uuid)
returns table(
  id uuid,
  task_id uuid,
  student_id uuid,
  student_name text,
  enrollment text,
  content text,
  attachment_path text,
  attachment_name text,
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
  select
    ts.id,
    ts.task_id,
    ts.student_id,
    s.full_name,
    s.enrollment,
    ts.content,
    ts.attachment_path,
    ts.attachment_name,
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
  order by s.full_name;
$function$;
