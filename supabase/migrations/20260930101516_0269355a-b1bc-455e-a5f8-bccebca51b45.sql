alter table public.students add column if not exists avatar_url text;

create or replace function public.student_update_profile(
  _full_name text,
  _avatar_url text default null
)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  _student public.students;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  update public.students
  set
    full_name = coalesce(nullif(trim(_full_name), ''), full_name),
    avatar_url = nullif(trim(coalesce(_avatar_url, '')), ''),
    updated_at = now()
  where user_id = auth.uid()
  returning * into _student;

  if _student.id is null then
    raise exception 'Perfil de aluno não encontrado';
  end if;

  return _student;
end;
$$;

revoke execute on function public.student_update_profile(text, text) from public, anon;
grant execute on function public.student_update_profile(text, text) to authenticated;