-- Harden academic attachment storage.
-- The bucket is private. Teachers can manage only files under their own
-- user-id folder; students can read only active materials they are linked to.
insert into storage.buckets (id, name, public)
values ('academic-attachments', 'academic-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "Teachers upload academic attachments" on storage.objects;
create policy "Teachers upload academic attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'academic-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('tasks', 'announcements', 'materials')
);

drop policy if exists "Teachers read own academic attachments" on storage.objects;
create policy "Teachers read own academic attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'academic-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Teachers update own academic attachments" on storage.objects;
create policy "Teachers update own academic attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'academic-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'academic-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('tasks', 'announcements', 'materials')
);

drop policy if exists "Teachers delete own academic attachments" on storage.objects;
create policy "Teachers delete own academic attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'academic-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Keep the existing student policy, but make sure it is recreated against the
-- private bucket so no public object access is accidentally introduced.
drop policy if exists "Students read academic materials" on storage.objects;
create policy "Students read academic materials"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'academic-attachments'
  and public.student_can_read_academic_material(name)
);
