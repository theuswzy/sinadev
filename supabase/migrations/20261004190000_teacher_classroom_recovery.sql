-- Teacher workspace recovery: make institution classes and roster ownership usable without
-- weakening tenant isolation. Teachers may claim only active classes in their active
-- institution that currently have no teacher. They may also move a student out of
-- an orphaned/unassigned class in the same institution.

create or replace function public.teacher_list_unassigned_classrooms()
returns table(id uuid, name text, code text, status text, student_count bigint)
language sql
stable
security definer
set search_path=''
as $function$
  select c.id,c.name,c.code,c.status,count(s.id)::bigint
  from public.classrooms c
  left join public.classroom_teachers ct on ct.classroom_id=c.id
  left join public.students s on s.classroom_id=c.id and s.institution_id=c.institution_id
  where c.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and c.status='active'
  group by c.id
  having count(ct.user_id)=0
  order by lower(c.name);
$function$;

create or replace function public.teacher_claim_classroom(_classroom_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  if not exists (
    select 1 from public.classrooms
    where id=_classroom_id and institution_id=inst and status='active'
  ) then
    raise exception 'Turma não encontrada na escola ativa.';
  end if;

  if exists (
    select 1 from public.classroom_teachers
    where classroom_id=_classroom_id and user_id=auth.uid()
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.classroom_teachers
    where classroom_id=_classroom_id
  ) then
    raise exception 'Esta turma já está atribuída a outro professor.';
  end if;

  insert into public.classroom_teachers(classroom_id,user_id)
  values(_classroom_id,auth.uid())
  on conflict do nothing;

  return true;
end;
$function$;

create or replace function public.teacher_enroll_student_in_classroom(
  _student_id uuid,
  _classroom_id uuid,
  _enrollment text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  inst uuid;
  student_inst uuid;
  student_user uuid;
  current_classroom uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_enrollment),'') is null then raise exception 'Informe a matrícula.'; end if;

  if not exists (
    select 1
    from public.classrooms c
    join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
    where c.id=_classroom_id and c.institution_id=inst and c.status='active'
  ) then
    raise exception 'A turma selecionada não pertence a você. Assuma a turma primeiro ou solicite ao administrador.';
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

  if current_classroom is not null
     and current_classroom<>_classroom_id
     and exists (
       select 1 from public.classroom_teachers
       where classroom_id=current_classroom
     )
     and not exists (
       select 1 from public.classroom_teachers
       where classroom_id=current_classroom and user_id=auth.uid()
     ) then
    raise exception 'Este aluno já está em uma turma atribuída a outro professor. Solicite a mudança ao administrador.';
  end if;

  update public.students
  set institution_id=inst,
      classroom_id=_classroom_id,
      classroom=(select c.name from public.classrooms c where c.id=_classroom_id),
      enrollment=trim(_enrollment),
      teacher_id=auth.uid(),
      updated_at=now()
  where id=_student_id;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,student_user,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user,inst)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$function$;

revoke all on function public.teacher_list_unassigned_classrooms() from public,anon;
revoke all on function public.teacher_claim_classroom(uuid) from public,anon;
revoke all on function public.teacher_enroll_student_in_classroom(uuid,uuid,text) from public,anon;

grant execute on function public.teacher_list_unassigned_classrooms() to authenticated;
grant execute on function public.teacher_claim_classroom(uuid) to authenticated;
grant execute on function public.teacher_enroll_student_in_classroom(uuid,uuid,text) to authenticated;
