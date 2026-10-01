-- Add the Instituto Central de Educação Isaías Alves (ICEIA) to the public school directory.
-- Official Bahia government sources identify ICEIA as a state-network school in Salvador.
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
select
  'Instituto Central de Educação Isaías Alves',
  'instituto central de educação isaías alves',
  'Salvador',
  'BA',
  'estadual',
  'publica',
  'SEC Bahia',
  2026,
  'active'
where not exists (
  select 1
  from public.school_directory
  where normalized_name = 'instituto central de educação isaías alves'
    and municipality = 'Salvador'
    and state = 'BA'
    and network_type = 'estadual'
);
