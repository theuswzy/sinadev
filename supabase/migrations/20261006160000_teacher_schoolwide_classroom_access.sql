-- SINA: teacher school-wide classroom visibility with opt-in teaching assignments.
-- Teachers in a school can see every active classroom in that same school.
-- Teaching/gradebook/write access remains scoped to classrooms the teacher joins.

create or replace function public.teacher_list_institution_classrooms()
returns table(
  id uuid,
  name text,
  code text,
  status text,
  student_count bigint,
  teacher_count bigint,
  is_linked boolean
)
language sql
stable
security definer
set search_path=''
as $$
  select
    c.id,
    c.name,
    c.code,
    c.status,
    count(distinct s.id)::bigint as student_count,
    count(distinct ct_all.user_id)::bigint as teacher_count,
    exists (
      select 1
      from public.classroom_teachers ct_me
      where ct_me.classroom_id=c.id
        and ct_me.user_id=auth.uid()
    ) as is_linked
  from public.classrooms c
  left join public.students s
    on s.classroom_id=c.id
   and s.institution_id=c.institution_id
  left join public.classroom_teachers ct_all
    on ct_all.classroom_id=c.id
  where c.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and c.status='active'
  group by c.id,c.name,c.code,c.status
  order by lower(c.name);
$$;

create or replace function public.teacher_join_classroom(_classroom_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  if not exists (
    select 1
    from public.classrooms c
    where c.id=_classroom_id
      and c.institution_id=inst
      and c.status='active'
  ) then
    raise exception 'Turma não encontrada nesta escola.';
  end if;

  insert into public.classroom_teachers(classroom_id,user_id)
  values(_classroom_id,auth.uid())
  on conflict do nothing;

  return true;
end;
$$;

create or replace function public.teacher_leave_classroom(_classroom_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  delete from public.classroom_teachers ct
  using public.classrooms c
  where ct.classroom_id=_classroom_id
    and ct.user_id=auth.uid()
    and c.id=ct.classroom_id
    and c.institution_id=sina_private.current_institution('teacher'::public.app_role);

  return found;
end;
$$;

revoke all on function public.teacher_list_institution_classrooms() from public,anon;
revoke all on function public.teacher_join_classroom(uuid) from public,anon;
revoke all on function public.teacher_leave_classroom(uuid) from public,anon;

grant execute on function public.teacher_list_institution_classrooms() to authenticated;
grant execute on function public.teacher_join_classroom(uuid) to authenticated;
grant execute on function public.teacher_leave_classroom(uuid) to authenticated;
