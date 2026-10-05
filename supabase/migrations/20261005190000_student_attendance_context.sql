-- Student frequency must retain the academic context that makes each
-- record understandable: class, subject, teacher, date and status.

CREATE OR REPLACE FUNCTION public.student_list_attendance_detailed(_limit integer DEFAULT 180)
RETURNS TABLE(
  attendance_date date,
  status text,
  note text,
  classroom_id uuid,
  classroom_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    a.attendance_date,
    a.status,
    a.note,
    a.classroom_id,
    c.name,
    cs.subject_id,
    su.name,
    a.teacher_id,
    coalesce(p.display_name, 'Professor não identificado')
  from public.attendance_records a
  join public.students s
    on s.id=a.student_id
   and s.user_id=auth.uid()
   and s.institution_id=a.institution_id
  join public.classrooms c on c.id=a.classroom_id
  left join public.classroom_subjects cs
    on cs.classroom_id=a.classroom_id
   and cs.teacher_id=a.teacher_id
   and cs.institution_id=a.institution_id
  left join public.subjects su on su.id=cs.subject_id
  left join public.profiles p on p.user_id=a.teacher_id
  where a.institution_id=sina_private.current_institution('student'::public.app_role)
  order by a.attendance_date desc, su.name nulls last
  limit greatest(1,least(_limit,180));
$function$;

REVOKE EXECUTE ON FUNCTION public.student_list_attendance_detailed(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.student_list_attendance_detailed(integer) TO authenticated;
