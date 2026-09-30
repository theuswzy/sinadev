-- SINA: student profile storage
-- Creates the public avatar bucket and limits uploads to each authenticated user's own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  6291456,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 6291456,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "Students can upload their own avatars" on storage.objects;
create policy "Students can upload their own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Students can update their own avatars" on storage.objects;
create policy "Students can update their own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "Students can delete their own avatars" on storage.objects;
create policy "Students can delete their own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid()::text)
);
