-- Keep dashboard access independent from academic linking while strictly scoping
-- announcements, tasks and completions to the student's own teacher/classroom.

drop policy if exists "announcements_select_student" on public.announcements;
create policy "announcements_select_student"
on public.announcements for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.user_id = auth.uid()
      and s.teacher_id = announcements.teacher_id
      and s.classroom = announcements.classroom
  )
);

drop policy if exists "tasks_select_student" on public.tasks;
create policy "tasks_select_student"
on public.tasks for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.user_id = auth.uid()
      and s.teacher_id = tasks.teacher_id
      and s.classroom = tasks.classroom
  )
);

drop policy if exists "task_completions_select_student" on public.task_completions;
create policy "task_completions_select_student"
on public.task_completions for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.tasks t
      on t.id = task_completions.task_id
     and t.teacher_id = s.teacher_id
     and t.classroom = s.classroom
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "task_completions_update_student" on public.task_completions;
create policy "task_completions_update_student"
on public.task_completions for all
to authenticated
using (
  exists (
    select 1
    from public.students s
    join public.tasks t
      on t.id = task_completions.task_id
     and t.teacher_id = s.teacher_id
     and t.classroom = s.classroom
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.students s
    join public.tasks t
      on t.id = task_completions.task_id
     and t.teacher_id = s.teacher_id
     and t.classroom = s.classroom
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
);

create or replace function public.student_list_announcements()
returns setof public.announcements
language sql
security definer
set search_path = ''
as $$
  select a.*
  from public.announcements a
  where exists (
    select 1
    from public.students s
    where s.user_id = auth.uid()
      and s.teacher_id = a.teacher_id
      and s.classroom = a.classroom
  )
  order by a.created_at desc
  limit 30;
$$;

create or replace function public.student_list_tasks()
returns table (
  id uuid,
  classroom text,
  subject text,
  title text,
  description text,
  due_at timestamptz,
  created_at timestamptz,
  completed boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    t.id,
    t.classroom,
    t.subject,
    t.title,
    t.description,
    t.due_at,
    t.created_at,
    coalesce(tc.completed, false) as completed
  from public.tasks t
  join public.students s
    on s.user_id = auth.uid()
   and s.teacher_id = t.teacher_id
   and s.classroom = t.classroom
  left join public.task_completions tc
    on tc.task_id = t.id
   and tc.student_id = s.id
  order by (t.due_at is null), t.due_at, t.created_at desc
  limit 50;
$$;

create or replace function public.student_set_task_completed(
  _task_id uuid,
  _completed boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_record public.students;
begin
  select s.* into student_record
  from public.students s
  where s.user_id = auth.uid()
  limit 1;

  if student_record.id is null then
    raise exception 'Perfil de aluno não encontrado.';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = _task_id
      and t.teacher_id = student_record.teacher_id
      and t.classroom = student_record.classroom
      and student_record.teacher_id is not null
  ) then
    raise exception 'Tarefa não encontrada para este aluno.';
  end if;

  insert into public.task_completions (task_id, student_id, completed, updated_at)
  values (_task_id, student_record.id, _completed, now())
  on conflict (task_id, student_id)
  do update set completed = excluded.completed, updated_at = now();

  return true;
end;
$$;

revoke all on function public.student_list_announcements() from public, anon;
grant execute on function public.student_list_announcements() to authenticated;

revoke all on function public.student_list_tasks() from public, anon;
grant execute on function public.student_list_tasks() to authenticated;

revoke all on function public.student_set_task_completed(uuid, boolean) from public, anon;
grant execute on function public.student_set_task_completed(uuid, boolean) to authenticated;
