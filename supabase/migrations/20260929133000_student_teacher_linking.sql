-- SINA: student self-registration and teacher-managed academic linking
-- Keeps the existing visual/application model while moving student ownership
-- from manual teacher creation to authenticated student accounts.

alter table public.students
  alter column teacher_id drop not null;

create unique index if not exists students_user_id_unique
  on public.students(user_id)
  where user_id is not null;

create or replace function public.ensure_student_profile()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing_role public.app_role;
  display_name text;
begin
  if uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select ur.role into existing_role
  from public.user_roles ur
  where ur.user_id = uid
    and ur.role in ('admin'::public.app_role, 'teacher'::public.app_role)
  order by case when ur.role = 'admin'::public.app_role then 0 else 1 end
  limit 1;

  if existing_role is not null then
    return false;
  end if;

  select coalesce(nullif(p.display_name, ''), nullif(au.raw_user_meta_data->>'display_name', ''), split_part(au.email, '@', 1))
    into display_name
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  where au.id = uid;

  insert into public.students (user_id, full_name, enrollment, classroom, teacher_id)
  values (uid, coalesce(display_name, 'Aluno'), '', '', null)
  on conflict (user_id) where user_id is not null do nothing;

  return true;
end;
$$;

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

  -- Garante que todo aluno autenticado tenha seu próprio registro,
  -- mesmo quando ainda não existe vínculo com professor/turma.
  perform public.ensure_student_profile();

  return query
    select s.*
    from public.students s
    where s.user_id = auth.uid()
    limit 1;
end;
$$;

create or replace function public.teacher_list_students()
returns setof public.students
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  return query
    select s.*
    from public.students s
    where s.teacher_id = auth.uid()
       or s.teacher_id is null
    order by
      case when s.teacher_id is null then 0 else 1 end,
      lower(s.full_name);
end;
$$;

create or replace function public.teacher_link_student(
  _student_id uuid,
  _enrollment text,
  _classroom text
)
returns public.students
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.students;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if nullif(trim(_enrollment), '') is null or nullif(trim(_classroom), '') is null then
    raise exception 'Matrícula e turma são obrigatórias.';
  end if;

  update public.students
     set teacher_id = auth.uid(),
         enrollment = trim(_enrollment),
         classroom = trim(_classroom),
         updated_at = now()
   where id = _student_id
     and (teacher_id is null or teacher_id = auth.uid())
   returning * into result_row;

  if result_row.id is null then
    raise exception 'Aluno não encontrado ou já vinculado a outro professor.';
  end if;

  return result_row;
end;
$$;

create or replace function public.teacher_update_attendance(
  _student_id uuid,
  _attendance numeric
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if _attendance < 0 or _attendance > 100 then
    raise exception 'Informe uma frequência entre 0 e 100.';
  end if;

  update public.students
     set attendance = _attendance,
         updated_at = now()
   where id = _student_id
     and teacher_id = auth.uid();

  return found;
end;
$$;

create or replace function public.teacher_upsert_grade(
  _student_id uuid,
  _subject text,
  _period integer,
  _score numeric,
  _absences integer
)
returns public.grades
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.grades;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if nullif(trim(_subject), '') is null then
    raise exception 'Informe a disciplina.';
  end if;

  if _period < 1 or _period > 4 or _score < 0 or _score > 10 or _absences < 0 then
    raise exception 'Dados da nota inválidos.';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = _student_id and s.teacher_id = auth.uid()
  ) then
    raise exception 'Aluno não vinculado a este professor.';
  end if;

  insert into public.grades (student_id, subject, period, score, absences)
  values (_student_id, trim(_subject), _period, _score, _absences)
  on conflict (student_id, subject, period)
  do update set
    score = excluded.score,
    absences = excluded.absences,
    updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.ensure_student_profile() from public, anon;
grant execute on function public.ensure_student_profile() to authenticated;

revoke all on function public.student_get_profile() from public, anon;
grant execute on function public.student_get_profile() to authenticated;

revoke all on function public.teacher_list_students() from public, anon;
grant execute on function public.teacher_list_students() to authenticated;

revoke all on function public.teacher_link_student(uuid, text, text) from public, anon;
grant execute on function public.teacher_link_student(uuid, text, text) to authenticated;

revoke all on function public.teacher_update_attendance(uuid, numeric) from public, anon;
grant execute on function public.teacher_update_attendance(uuid, numeric) to authenticated;

revoke all on function public.teacher_upsert_grade(uuid, text, integer, numeric, integer) from public, anon;
grant execute on function public.teacher_upsert_grade(uuid, text, integer, numeric, integer) to authenticated;
