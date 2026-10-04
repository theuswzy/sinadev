-- Fix teacher roster classification for students whose class has no assigned teacher.
create or replace function public.teacher_list_institution_students()
returns table(
  id uuid,
  full_name text,
  enrollment text,
  classroom text,
  classroom_id uuid,
  attendance numeric,
  teacher_id uuid,
  class_status text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    s.id,
    s.full_name,
    s.enrollment,
    s.classroom,
    s.classroom_id,
    s.attendance,
    s.teacher_id,
    case
      when s.classroom_id is null then 'sem_turma'
      when exists (
        select 1 from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      ) then 'minha_turma'
      when exists (
        select 1 from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and c.institution_id=s.institution_id
          and c.status='active'
      ) then 'outra_turma'
      else 'sem_turma'
    end
  from public.students s
  where s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by lower(s.full_name);
$function$;

revoke all on function public.teacher_list_institution_students() from public, anon;
grant execute on function public.teacher_list_institution_students() to authenticated;
