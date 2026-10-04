-- SINA: allow administrators to link a student account to an institution/school.
-- The operation is tenant-safe: an administrator may only choose an institution
-- where that same administrator has an active admin membership.

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
    case
      when s.institution_id is null then 'sem_escola'
      else 'vinculado'
    end
  from public.students s
  left join public.institutions i on i.id=s.institution_id
  left join public.classrooms c on c.id=s.classroom_id and c.institution_id=s.institution_id
  where s.institution_id is null
     or exists (
       select 1
       from public.institution_memberships im
       where im.user_id=auth.uid()
         and im.institution_id=s.institution_id
         and im.role='admin'::public.app_role
         and im.status='active'
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
  student_user_id uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if not exists (
    select 1
    from public.institution_memberships im
    join public.institutions i on i.id=im.institution_id
    where im.user_id=auth.uid()
      and im.institution_id=_institution_id
      and im.role='admin'::public.app_role
      and im.status='active'
      and i.status='active'
  ) then
    raise exception 'Você não administra esta escola.';
  end if;

  select s.user_id
    into student_user_id
  from public.students s
  where s.id=_student_id
  for update;

  if student_user_id is null then
    raise exception 'Aluno não encontrado.';
  end if;

  if exists (
    select 1 from public.students
    where id=_student_id
      and institution_id is not null
  ) then
    raise exception 'Este aluno já está vinculado a uma escola.';
  end if;

  update public.students
  set institution_id=_institution_id,
      classroom_id=null,
      classroom='',
      teacher_id=null,
      updated_at=now()
  where id=_student_id
    and institution_id is null;

  if not found then
    raise exception 'Não foi possível vincular o aluno.';
  end if;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(_institution_id,student_user_id,'student'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active', updated_at=now();

  return true;
end;
$$;

revoke all on function public.admin_list_student_school_links() from public,anon;
revoke all on function public.admin_link_student_to_institution(uuid,uuid) from public,anon;
grant execute on function public.admin_list_student_school_links() to authenticated;
grant execute on function public.admin_link_student_to_institution(uuid,uuid) to authenticated;
