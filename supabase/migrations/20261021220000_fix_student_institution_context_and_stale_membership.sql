create or replace function public.teacher_link_student_to_school(_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
  student_user_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem escola ativa.'; end if;

  if not exists (select 1 from public.institutions where id=inst and status='active') then
    raise exception 'Escola ativa não encontrada.';
  end if;

  select s.user_id into student_user_id
  from public.students s
  where s.id=_student_id and s.institution_id is null
  for update;

  if student_user_id is null then
    raise exception 'Aluno não encontrado ou já vinculado a uma escola.';
  end if;

  update public.students
  set institution_id=inst, classroom_id=null, classroom='', teacher_id=null, updated_at=now()
  where id=_student_id and institution_id is null;

  if not found then raise exception 'Não foi possível vincular o aluno à escola.'; end if;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,student_user_id,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user_id,inst)
  on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$function$;

create or replace function public.admin_link_student_to_institution(_student_id uuid, _institution_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  old_institution uuid;
  student_user uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if not exists (select 1 from public.institutions where id=_institution_id and status='active') then
    raise exception 'Escola/instituição inválida ou inativa.';
  end if;

  if not exists (
    select 1 from public.institution_memberships
    where user_id=auth.uid() and institution_id=_institution_id
      and role='admin'::public.app_role and status='active'
  ) then
    raise exception 'Você não é administrador desta escola.';
  end if;

  select s.user_id,s.institution_id into student_user,old_institution
  from public.students s where s.id=_student_id for update;

  if student_user is null then raise exception 'Aluno não encontrado.'; end if;

  if old_institution is not null and not exists (
    select 1 from public.institution_memberships
    where user_id=auth.uid() and institution_id=old_institution
      and role='admin'::public.app_role and status='active'
  ) then
    raise exception 'Você não tem permissão para mover este aluno de outra instituição.';
  end if;

  update public.students
  set institution_id=_institution_id, classroom_id=null, classroom='', teacher_id=null, updated_at=now()
  where id=_student_id;

  if old_institution is not null and old_institution<>_institution_id then
    update public.institution_memberships
    set status='inactive',updated_at=now()
    where user_id=student_user and institution_id=old_institution
      and role='student'::public.app_role and status='active';
  end if;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(_institution_id,student_user,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user,_institution_id)
  on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$function$;

revoke all on function public.teacher_link_student_to_school(uuid) from public,anon;
grant execute on function public.teacher_link_student_to_school(uuid) to authenticated;
revoke all on function public.admin_link_student_to_institution(uuid,uuid) from public,anon;
grant execute on function public.admin_link_student_to_institution(uuid,uuid) to authenticated;