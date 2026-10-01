-- Add the Instituto Central de Educação Isaías Alves (ICEIA) to the public school directory.
-- This migration is idempotent so syncing/reapplying the repository does not duplicate the school.

insert into public.school_directory (
  name,
  normalized_name,
  municipality,
  state,
  network_type,
  administrative_type,
  source,
  source_year,
  status
)
values (
  'Instituto Central de Educação Isaías Alves',
  'instituto central de educação isaías alves',
  'Salvador',
  'BA',
  'estadual',
  'publica',
  'SEC Bahia',
  2026,
  'active'
)
on conflict (normalized_name, municipality, state, network_type)
do update set
  name = excluded.name,
  administrative_type = excluded.administrative_type,
  source = excluded.source,
  source_year = excluded.source_year,
  status = 'active',
  updated_at = now();
