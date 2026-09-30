create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  classroom text not null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_classroom_created_idx
  on public.announcements (classroom, created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  classroom text not null,
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_classroom_due_idx
  on public.tasks (classroom, due_at);

create table if not exists public.task_completions (
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (task_id, student_id)
);

create index if not exists task_completions_student_idx
  on public.task_completions (student_id, completed);

alter table public.announcements enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

drop policy if exists "announcements_select_student" on public.announcements;
drop policy if exists "announcements_select_teacher" on public.announcements;
drop policy if exists "tasks_select_student" on public.tasks;
drop policy if exists "tasks_select_teacher" on public.tasks;
drop policy if exists "task_completions_select_student" on public.task_completions;
drop policy if exists "task_completions_update_student" on public.task_completions;

create policy "announcements_select_student"
on public.announcements for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.user_id = auth.uid()
      and s.teacher_id is not null
      and s.classroom = announcements.classroom
  )
);

create policy "announcements_select_teacher"
on public.announcements for select
to authenticated
using (teacher_id = auth.uid());

create policy "tasks_select_student"
on public.tasks for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.user_id = auth.uid()
      and s.teacher_id is not null
      and s.classroom = tasks.classroom
  )
);

create policy "tasks_select_teacher"
on public.tasks for select
to authenticated
using (teacher_id = auth.uid());

create policy "task_completions_select_student"
on public.task_completions for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
);

create policy "task_completions_update_student"
on public.task_completions for all
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
);

create or replace function public.teacher_create_announcement(
  _classroom text,
  _title text,
  _content text
)
returns public.announcements
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.announcements;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if not exists (
    select 1 from public.students s
    where s.teacher_id = auth.uid()
      and s.classroom = trim(_classroom)
  ) then
    raise exception 'Você não possui alunos vinculados a essa turma.';
  end if;

  insert into public.announcements (teacher_id, classroom, title, content)
  values (auth.uid(), trim(_classroom), trim(_title), trim(_content))
  returning * into result;

  return result;
end;
$$;

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
      and s.teacher_id is not null
      and s.classroom = a.classroom
  )
  order by a.created_at desc
  limit 30;
$$;

create or replace function public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.tasks;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if not exists (
    select 1 from public.students s
    where s.teacher_id = auth.uid()
      and s.classroom = trim(_classroom)
  ) then
    raise exception 'Você não possui alunos vinculados a essa turma.';
  end if;

  insert into public.tasks (teacher_id, classroom, subject, title, description, due_at)
  values (auth.uid(), trim(_classroom), trim(_subject), trim(_title), trim(coalesce(_description, '')), _due_at)
  returning * into result;

  return result;
end;
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
   and s.teacher_id is not null
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

grant execute on function public.teacher_create_announcement(text, text, text) to authenticated;
grant execute on function public.student_list_announcements() to authenticated;
grant execute on function public.teacher_create_task(text, text, text, text, timestamptz) to authenticated;
grant execute on function public.student_list_tasks() to authenticated;
grant execute on function public.student_set_task_completed(uuid, boolean) to authenticated;

drop trigger if exists announcements_set_updated_at on public.announcements;
drop trigger if exists tasks_set_updated_at on public.tasks;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at_timestamp();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at_timestamp();

alter table public.announcements replica identity full;
alter table public.tasks replica identity full;
