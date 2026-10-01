-- Teacher classroom management, communication attachments, and student task completion.
-- Applied to the active Lovable/Supabase database before committing this migration.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  classroom text not null,
  title text not null,
  content text not null,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  classroom text not null,
  subject text not null,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_completions (
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (task_id, student_id)
);

alter table public.announcements enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

-- Academic attachment storage is private; access is granted only to the teacher
-- who uploaded the file or students in the published classroom.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academic-attachments',
  'academic-attachments',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students and owners can read announcements" on public.announcements;
create policy "Students and owners can read announcements"
on public.announcements
for select
to authenticated
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.students s
    where s.user_id = auth.uid()
      and s.classroom = announcements.classroom
  )
);

drop policy if exists "Teachers can insert announcements" on public.announcements;
create policy "Teachers can insert announcements"
on public.announcements
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and public.has_role(auth.uid(), 'teacher'::public.app_role)
);

drop policy if exists "Teachers can update own announcements" on public.announcements;
create policy "Teachers can update own announcements"
on public.announcements
for update
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers can delete own announcements" on public.announcements;
create policy "Teachers can delete own announcements"
on public.announcements
for delete
to authenticated
using (teacher_id = auth.uid());

drop policy if exists "Students and owners can read tasks" on public.tasks;
create policy "Students and owners can read tasks"
on public.tasks
for select
to authenticated
using (
  teacher_id = auth.uid()
  or exists (
    select 1
    from public.students s
    where s.user_id = auth.uid()
      and s.classroom = tasks.classroom
  )
);

drop policy if exists "Teachers can insert tasks" on public.tasks;
create policy "Teachers can insert tasks"
on public.tasks
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and public.has_role(auth.uid(), 'teacher'::public.app_role)
);

drop policy if exists "Teachers can update own tasks" on public.tasks;
create policy "Teachers can update own tasks"
on public.tasks
for update
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers can delete own tasks" on public.tasks;
create policy "Teachers can delete own tasks"
on public.tasks
for delete
to authenticated
using (teacher_id = auth.uid());

drop policy if exists "Students can read their task completions" on public.task_completions;
create policy "Students can read their task completions"
on public.task_completions
for select
to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "Students can manage their task completions" on public.task_completions;
create policy "Students can manage their task completions"
on public.task_completions
for insert
to authenticated
with check (
  exists (
    select 1 from public.students s
    where s.id = task_completions.student_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "Students can update their task completions" on public.task_completions;
create policy "Students can update their task completions"
on public.task_completions
for update
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

drop policy if exists "Teachers upload academic attachments" on storage.objects;
create policy "Teachers upload academic attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'academic-attachments'
  and public.has_role(auth.uid(), 'teacher'::public.app_role)
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Teachers read their academic attachments" on storage.objects;
create policy "Teachers read their academic attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'academic-attachments'
  and (
    (
      public.has_role(auth.uid(), 'teacher'::public.app_role)
      and split_part(name, '/', 1) = auth.uid()::text
    )
    or exists (
      select 1
      from public.announcements a
      join public.students s on s.classroom = a.classroom and s.user_id = auth.uid()
      where a.attachment_path = storage.objects.name
    )
    or exists (
      select 1
      from public.tasks t
      join public.students s on s.classroom = t.classroom and s.user_id = auth.uid()
      where t.attachment_path = storage.objects.name
    )
  )
);

drop policy if exists "Teachers update their academic attachments" on storage.objects;
create policy "Teachers update their academic attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'academic-attachments'
  and public.has_role(auth.uid(), 'teacher'::public.app_role)
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'academic-attachments'
  and public.has_role(auth.uid(), 'teacher'::public.app_role)
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Teachers delete their academic attachments" on storage.objects;
create policy "Teachers delete their academic attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'academic-attachments'
  and public.has_role(auth.uid(), 'teacher'::public.app_role)
  and split_part(name, '/', 1) = auth.uid()::text
);

create or replace function public.teacher_create_announcement(
  _classroom text,
  _title text,
  _content text,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.announcements;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if nullif(trim(_classroom), '') is null then
    raise exception 'Selecione uma turma.';
  end if;

  if nullif(trim(_title), '') is null then
    raise exception 'Informe o título do aviso.';
  end if;

  if nullif(trim(_content), '') is null then
    raise exception 'Escreva o conteúdo do aviso.';
  end if;

  if not exists (
    select 1 from public.students
    where teacher_id = auth.uid()
      and classroom = trim(_classroom)
  ) then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  insert into public.announcements (
    teacher_id, classroom, title, content,
    attachment_path, attachment_name, attachment_size, attachment_type
  )
  values (
    auth.uid(), trim(_classroom), trim(_title), trim(_content),
    nullif(trim(_attachment_path), ''),
    nullif(trim(_attachment_name), ''),
    _attachment_size,
    nullif(trim(_attachment_type), '')
  )
  returning * into result_row;

  return result_row;
end;
$function$;

create or replace function public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.tasks;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if nullif(trim(_classroom), '') is null then
    raise exception 'Selecione uma turma.';
  end if;

  if nullif(trim(_subject), '') is null then
    raise exception 'Informe a disciplina.';
  end if;

  if nullif(trim(_title), '') is null then
    raise exception 'Informe o título da atividade.';
  end if;

  if not exists (
    select 1 from public.students
    where teacher_id = auth.uid()
      and classroom = trim(_classroom)
  ) then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  insert into public.tasks (
    teacher_id, classroom, subject, title, description, due_at,
    attachment_path, attachment_name, attachment_size, attachment_type
  )
  values (
    auth.uid(), trim(_classroom), trim(_subject), trim(_title),
    coalesce(trim(_description), ''), _due_at,
    nullif(trim(_attachment_path), ''),
    nullif(trim(_attachment_name), ''),
    _attachment_size,
    nullif(trim(_attachment_type), '')
  )
  returning * into result_row;

  return result_row;
end;
$function$;

create or replace function public.student_list_announcements()
returns table (
  id uuid,
  teacher_id uuid,
  classroom text,
  title text,
  content text,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path to ''
as $function$
  select a.id, a.teacher_id, a.classroom, a.title, a.content,
         a.attachment_path, a.attachment_name, a.attachment_size, a.attachment_type,
         a.created_at, a.updated_at
  from public.announcements a
  where exists (
    select 1 from public.students s
    where s.user_id = auth.uid()
      and s.classroom = a.classroom
  )
  order by a.created_at desc
  limit 100;
$function$;

create or replace function public.student_list_tasks()
returns table (
  id uuid,
  classroom text,
  subject text,
  title text,
  description text,
  due_at timestamptz,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  created_at timestamptz,
  completed boolean
)
language sql
security definer
set search_path to ''
as $function$
  select t.id, t.classroom, t.subject, t.title, t.description, t.due_at,
         t.attachment_path, t.attachment_name, t.attachment_size, t.attachment_type,
         t.created_at,
         coalesce(tc.completed, false) as completed
  from public.tasks t
  join public.students s
    on s.user_id = auth.uid()
   and s.classroom = t.classroom
  left join public.task_completions tc
    on tc.task_id = t.id
   and tc.student_id = s.id
  order by coalesce(t.due_at, t.created_at) asc
  limit 100;
$function$;

create or replace function public.student_set_task_completed(
  _task_id uuid,
  _completed boolean
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  student_id_var uuid;
begin
  select id into student_id_var
  from public.students
  where user_id = auth.uid()
  limit 1;

  if student_id_var is null then
    raise exception 'Perfil de aluno não encontrado.';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = _task_id
      and exists (
        select 1
        from public.students s
        where s.id = student_id_var
          and s.classroom = t.classroom
      )
  ) then
    raise exception 'Tarefa não disponível para este aluno.';
  end if;

  insert into public.task_completions (task_id, student_id, completed, updated_at)
  values (_task_id, student_id_var, _completed, now())
  on conflict (task_id, student_id)
  do update set completed = excluded.completed, updated_at = now();

  return true;
end;
$function$;

create or replace function public.teacher_unlink_student(_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  update public.students
     set teacher_id = null,
         enrollment = '',
         classroom = '',
         updated_at = now()
   where id = _student_id
     and teacher_id = auth.uid();

  return found;
end;
$function$;

grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_unlink_student(uuid) to authenticated;
grant execute on function public.student_list_announcements() to authenticated;
grant execute on function public.student_list_tasks() to authenticated;
grant execute on function public.student_set_task_completed(uuid,boolean) to authenticated;
