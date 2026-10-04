-- SINA: fix teacher enrollment into classrooms.
-- Teachers can enroll into active classrooms in their institution when the
-- classroom has no teacher yet; the first enrollment claims that classroom.
-- A classroom already assigned to another teacher remains protected.

create or replace function public.teacher_enroll_student_in_classroom(_student_id uuid, _classroom_id uuid, _enrollment text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inst uuid;
  student_user uuid;
  student_inst uuid;
  current_classroom uuid;
  classroom_teacher_exists boolean;
  teacher_has_class boolean;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;

  if nullif(trim(_enrollment),'') is null then
    raise exception 'Informe a matrícula antes de vincular o aluno.';
  end if;

  if not exists (
    select 1 from public.classrooms c
    where c.id=_classroom_id and c.institution_id=inst and c.status='active'
  ) then
    raise exception 'A turma selecionada não pertence à escola ativa ou está inativa.';
  end if;

  select exists (select 1 from public.classroom_teachers ct where ct.classroom_id=_classroom_id and ct.user_id=auth.uid())
    into teacher_has_class;

  select exists (select 1 from public.classroom_teachers ct where ct.classroom_id=_classroom_id)
    into classroom_teacher_exists;

  if not teacher_has_class then
    if classroom_teacher_exists then
      raise exception 'Esta turma já está atribuída a outro professor. Solicite a mudança ao administrador.';
    end if;

    insert into public.classroom_teachers(classroom_id,user_id)
    values(_classroom_id,auth.uid())
    on conflict do nothing;
  end if;

  select s.user_id,s.institution_id,s.classroom_id
    into student_user,student_inst,current_classroom
  from public.students s
  where s.id=_student_id
  for update;

  if student_user is null then raise exception 'Aluno não encontrado.'; end if;

  if student_inst is not null and student_inst<>inst then
    raise exception 'Este aluno pertence a outra instituição.';
  end if;

  if current_classroom is not null and current_classroom<>_classroom_id
     and exists (select 1 from public.classroom_teachers where classroom_id=current_classroom)
     and not exists (select 1 from public.classroom_teachers where classroom_id=current_classroom and user_id=auth.uid()) then
    raise exception 'Este aluno já está em uma turma atribuída a outro professor. Solicite a mudança ao administrador.';
  end if;

  begin
    update public.students
    set institution_id=inst,
        classroom_id=_classroom_id,
        classroom=(select c.name from public.classrooms c where c.id=_classroom_id),
        enrollment=trim(_enrollment),
        teacher_id=auth.uid(),
        updated_at=now()
    where id=_student_id;
  exception
    when unique_violation then
      raise exception 'A matrícula % já está em uso por este professor.', trim(_enrollment);
  end;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,student_user,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user,inst)
  on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$$;

revoke execute on function public.teacher_enroll_student_in_classroom(uuid,uuid,text) from public,anon;
grant execute on function public.teacher_enroll_student_in_classroom(uuid,uuid,text) to authenticated;
