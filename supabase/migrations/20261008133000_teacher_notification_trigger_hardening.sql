-- Harden teacher delivery notifications against duplicate alerts.
-- The earlier task-submission RPC may also create a notification; the trigger
-- therefore checks the submission id before inserting a second alert.

create or replace function public.notify_teacher_task_submission()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  teacher_id uuid;
  task_title text;
  student_name text;
  inst uuid;
begin
  if new.status not in ('submitted','submitted_late') then
    return new;
  end if;

  select t.teacher_id,t.title,t.institution_id,s.full_name
    into teacher_id,task_title,inst,student_name
  from public.tasks t
  join public.students s on s.id=new.student_id
  where t.id=new.task_id
  limit 1;

  if teacher_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.user_id=teacher_id
      and n.metadata->>'submission_id'=new.id::text
      and n.type in ('task_submission','task_submission_late')
  ) then
    return new;
  end if;

  insert into public.notifications(user_id,type,title,body,link,metadata)
  values(
    teacher_id,
    case when new.status='submitted_late' then 'task_submission_late' else 'task_submission' end,
    case when new.status='submitted_late' then 'Nova entrega em atraso' else 'Nova entrega recebida' end,
    student_name||' enviou uma entrega para "'||coalesce(task_title,'atividade')||'".',
    '/professor/atividades',
    jsonb_build_object(
      'submission_id',new.id,
      'task_id',new.task_id,
      'student_id',new.student_id,
      'student_name',student_name,
      'late',new.status='submitted_late',
      'institution_id',inst
    )
  );

  return new;
end;
$function$;

drop trigger if exists trg_notify_teacher_task_submission on public.task_submissions;
create trigger trg_notify_teacher_task_submission
after insert or update of content,attachment_path,status
on public.task_submissions
for each row
execute function public.notify_teacher_task_submission();
