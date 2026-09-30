-- SINA: hardening, audit trail, avatar storage and realtime academic updates
-- This migration is idempotent and keeps authorization in PostgreSQL/RLS.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs(actor_user_id, created_at desc);

create index if not exists audit_logs_table_record_idx
  on public.audit_logs(table_name, record_id, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;

create or replace function public.write_academic_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  record_id_value uuid;
begin
  record_id_value := coalesce(new.id, old.id);

  insert into public.audit_logs (
    actor_user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    actor,
    tg_op,
    tg_table_name,
    record_id_value,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.write_academic_audit() from public, anon, authenticated;
grant execute on function public.write_academic_audit() to postgres;

drop trigger if exists students_audit_trigger on public.students;
create trigger students_audit_trigger
after insert or update or delete on public.students
for each row execute function public.write_academic_audit();

drop trigger if exists grades_audit_trigger on public.grades;
create trigger grades_audit_trigger
after insert or update or delete on public.grades
for each row execute function public.write_academic_audit();

-- Direct table access is restricted to the authenticated owner/teacher context.
-- Writes continue through the validated SECURITY DEFINER RPCs.
drop policy if exists "Students can read their own profile" on public.students;
create policy "Students can read their own profile"
on public.students
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Teachers can read their linked students" on public.students;
create policy "Teachers can read their linked students"
on public.students
for select
to authenticated
using (
  teacher_id = (select auth.uid())
);

drop policy if exists "Students can read their own grades" on public.grades;
create policy "Students can read their own grades"
on public.grades
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = grades.student_id
      and s.user_id = (select auth.uid())
  )
);

drop policy if exists "Teachers can read grades of their students" on public.grades;
create policy "Teachers can read grades of their students"
on public.grades
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = grades.student_id
      and s.teacher_id = (select auth.uid())
  )
);

-- Student photos use Supabase Storage instead of embedding Base64 data in rows.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Fix the student profile function delimiter and keep it safe for first login.
create or replace function public.student_get_profile()
returns setof public.students
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  perform public.ensure_student_profile();

  return query
    select s.*
    from public.students s
    where s.user_id = auth.uid()
    limit 1;
end;
$$;

revoke all on function public.student_get_profile() from public, anon;
grant execute on function public.student_get_profile() to authenticated;

-- Realtime keeps the student dashboard synchronized after teacher changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'students'
  ) then
    execute 'alter publication supabase_realtime add table public.students';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'grades'
  ) then
    execute 'alter publication supabase_realtime add table public.grades';
  end if;
end;
$$;
