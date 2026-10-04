-- SINA: teachers can bring an unassigned student into their active school.
-- A teacher never chooses an arbitrary institution: the destination is the
-- teacher's current active institution. After that, the normal class workflow
-- can place the student in one of the teacher's classrooms.

create or replace function public.teacher_list_unassigned_students()
returns table(
  id uuid,
  user_id uuid,
  full_name text,
  enrollment text,
  institution_id uuid,
  institution_name text,
  classroom_id uuid,
  classroom_name text,
  status text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    s.id,
    s.user_id,
    s.full_name,
    s.enrollment,
    s.institution_id,
    i.name,
    s.classroom_id,
    c.name,
    'sem_escola'
  from public.students s
  left join public.institutions i on i.id=s.institution_id
  left join public.classrooms c on c.id=s.classroom_id
  where s.institution_id is null
    and public.has_role(auth.uid(),'teacher'::public.app_role)
  order by lower(s.full_name);
$$;

create or replace function public.teacher_link_student_to_school(_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
  student_user_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if inst is null then
    raise exception 'Professor sem escola ativa.';
  end if;

  if not exists (
    select 1
    from public.institutions
    where id=inst and status='active'
  ) then
    raise exception 'Escola ativa não encontrada.';
  end if;

  select s.user_id into student_user_id
  from public.students s
  where s.id=_student_id
    and s.institution_id is null
  for update;

  if student_user_id is null then
    raise exception 'Aluno não encontrado ou já vinculado a uma escola.';
  end if;

  update public.students
  set institution_id=inst,
      classroom_id=null,
      classroom='',
      teacher_id=null,
      updated_at=now()
  where id=_student_id
    and institution_id is null;

  if not found then
    raise exception 'Não foi possível vincular o aluno à escola.';
  end if;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,student_user_id,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active', updated_at=now();

  return true;
end;
$$;

revoke all on function public.teacher_list_unassigned_students() from public,anon;
revoke all on function public.teacher_link_student_to_school(uuid) from public,anon;
grant execute on function public.teacher_list_unassigned_students() to authenticated;
grant execute on function public.teacher_link_student_to_school(uuid) to authenticated;
