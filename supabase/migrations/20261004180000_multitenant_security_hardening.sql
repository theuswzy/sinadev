-- Security hardening: keep teacher mutations tenant-scoped and remove legacy public RPC execution.
-- The frontend already routes through these RPCs; the database remains the source of truth.

create or replace function public.teacher_delete_announcement(_id uuid)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.announcements;
  inst uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  delete from public.announcements
  where id = _id
    and teacher_id = auth.uid()
    and institution_id = inst
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Aviso não encontrado.';
  end if;

  return result_row;
end;
$function$;

create or replace function public.teacher_delete_task(_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result_row public.tasks;
  inst uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  delete from public.tasks
  where id = _id
    and teacher_id = auth.uid()
    and institution_id = inst
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Atividade não encontrada.';
  end if;

  return result_row;
end;
$function$;

create or replace function public.teacher_unlink_roster_student(_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  update public.students
     set teacher_id = null,
         classroom_id = null,
         enrollment = '',
         classroom = '',
         updated_at = now()
   where id = _student_id
     and teacher_id = auth.uid()
     and institution_id = inst;

  return found;
end;
$function$;

create or replace function public.teacher_unlink_student(_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  update public.students
     set teacher_id = null,
         enrollment = '',
         classroom = '',
         updated_at = now()
   where id = _student_id
     and teacher_id = auth.uid()
     and institution_id = inst;

  return found;
end;
$function$;

create or replace function public.teacher_update_attendance(_student_id uuid, _attendance numeric)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  if _attendance < 0 or _attendance > 100 then
    raise exception 'Informe uma frequência entre 0 e 100.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  update public.students
     set attendance = _attendance,
         updated_at = now()
   where id = _student_id
     and teacher_id = auth.uid()
     and institution_id = inst;

  return found;
end;
$function$;

-- Legacy RPCs accidentally retained PUBLIC/anon execution. Their bodies already
-- validate roles, but exposing them to anonymous callers is unnecessary attack
-- surface and makes the API contract harder to reason about.
revoke execute on function public.teacher_link_roster_student(uuid,text,text) from public, anon;
revoke execute on function public.teacher_list_subject_assignments() from public, anon;
revoke execute on function public.teacher_unassign_subject_from_class(uuid) from public, anon;
revoke execute on function public.admin_assign_student_to_classroom(uuid,uuid,text) from public, anon;
revoke execute on function public.admin_list_students() from public, anon;
revoke execute on function public.admin_remove_student_from_classroom(uuid) from public, anon;
revoke execute on function public.student_list_subjects() from public, anon;
