-- SINA: server-side roster pagination/search indexes
-- Re-applied safely with IF NOT EXISTS.

create extension if not exists pg_trgm;

create index if not exists students_full_name_trgm_idx
  on public.students using gin (lower(full_name) gin_trgm_ops);

create index if not exists students_enrollment_trgm_idx
  on public.students using gin (lower(enrollment) gin_trgm_ops);

create index if not exists students_institution_full_name_key
  on public.students (institution_id, lower(full_name));
