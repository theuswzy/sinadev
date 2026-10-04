-- SINA: allow an administrator to link a student profile to a school/institution.
-- The operation is restricted to institutions where the caller is an active admin.
-- This keeps the multi-tenant boundary intact.

create or replace function public.admin_list_student_school_links()
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
    case when s.institution_id is null then 'sem_escola' else 'vinculado' end
  from public.students s
  left join public.institutions i on i.id=s.institution_id
  left join public.classrooms c on c.id=s.classroom_id and c.institution_id=s.institution_id
  where s.institution_id is null
     or exists (
       select 1
       from public.institution_memberships m
       where m.user_id=auth.uid()
         and m.institution_id=s.institution_id
         and m.role='admin'
         and m.status='active'
     )
  order by
    case when s.institution_id is null then 0 else 1 end,
    lower(s.full_name);
$$;

create or replace function public.admin_link_student_to_institution(
  _student_id uuid,
  _institution_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  target_status text;
  old_institution uuid;
  student_user uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  select i.status into target_status
  from public.institutions i
  where i.id=_institution_id;

  if target_status is null or target_status <> 'active' then
    raise exception 'Escola/instituição inválida ou inativa.';
  end if;

  if not exists (
    select 1
    from public.institution_memberships m
    where m.user_id=auth.uid()
      and m.institution_id=_institution_id
      and m.role='admin'
      and m.status='active'
  ) then
    raise exception 'Você não é administrador desta escola.';
  end if;

  select s.user_id,s.institution_id
    into student_user,old_institution
  from public.students s
  where s.id=_student_id
  for update;

  if student_user is null then
    raise exception 'Aluno não encontrado.';
  end if;

  if old_institution is not null
     and not exists (
       select 1
       from public.institution_memberships m
       where m.user_id=auth.uid()
         and m.institution_id=old_institution
         and m.role='admin'
         and m.status='active'
     ) then
    raise exception 'Você não tem permissão para mover este aluno de outra instituição.';
  end if;

  update public.students
  set institution_id=_institution_id,
      classroom_id=null,
      classroom='',
      teacher_id=null,
      updated_at=now()
  where id=_student_id;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(_institution_id,student_user,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(student_user,_institution_id)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id,
        updated_at=now();

  return true;
end;
$$;

revoke all on function public.admin_list_student_school_links() from public,anon;
grant execute on function public.admin_list_student_school_links() to authenticated;

revoke all on function public.admin_link_student_to_institution(uuid,uuid) from public,anon;
grant execute on function public.admin_link_student_to_institution(uuid,uuid) to authenticated;
