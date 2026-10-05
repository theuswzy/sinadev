-- Attendance is a subject-specific academic record.
-- A class can have multiple teachers and a teacher can own multiple subjects,
-- so student frequency must be tied to the subject as well as the teacher.

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS subject_id uuid;

UPDATE public.attendance_records ar
SET subject_id = candidates.subject_id
FROM (
  SELECT
    ar2.id,
    min(cs.subject_id::text)::uuid AS subject_id
  FROM public.attendance_records ar2
  JOIN public.classroom_subjects cs
    ON cs.classroom_id=ar2.classroom_id
   AND cs.teacher_id=ar2.teacher_id
   AND cs.institution_id=ar2.institution_id
  GROUP BY ar2.id
  HAVING count(cs.id)=1
) candidates
WHERE ar.id=candidates.id
  AND ar.subject_id IS NULL;

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_subject_id_fkey;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_student_id_attendance_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_date_subject_key
  ON public.attendance_records (student_id, attendance_date, subject_id);

CREATE OR REPLACE FUNCTION public.teacher_get_attendance(
  _classroom_id uuid,
  _date date,
  _subject_id uuid
)
RETURNS TABLE(
  student_id uuid,
  full_name text,
  enrollment text,
  status text,
  note text,
  subject_id uuid,
  subject_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    s.id,
    s.full_name,
    s.enrollment,
    coalesce(a.status,'present'),
    coalesce(a.note,''),
    su.id,
    su.name
  from public.students s
  join public.classroom_teachers ct
    on ct.classroom_id=s.classroom_id
   and ct.user_id=auth.uid()
  join public.classroom_subjects cs_teacher
    on cs_teacher.classroom_id=s.classroom_id
   and cs_teacher.subject_id=_subject_id
   and cs_teacher.teacher_id=auth.uid()
   and cs_teacher.institution_id=s.institution_id
  join public.subjects su
    on su.id=cs_teacher.subject_id
  left join public.attendance_records a
    on a.student_id=s.id
   and a.attendance_date=_date
   and a.subject_id=_subject_id
  where s.classroom_id=_classroom_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by s.full_name;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_save_attendance(
  _classroom_id uuid,
  _date date,
  _subject_id uuid,
  _rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  inst uuid;
  teacher uuid:=auth.uid();
  item jsonb;
  total integer:=0;
  student uuid;
  stat text;
  note_text text;
begin
  if not public.has_role(teacher,'teacher'::public.app_role) then
    raise exception 'Acesso restrito ao professor';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if not exists(
    select 1
    from public.classroom_subjects cs
    join public.classrooms c on c.id=cs.classroom_id
    join public.subjects su on su.id=cs.subject_id
    where cs.classroom_id=_classroom_id
      and cs.subject_id=_subject_id
      and cs.teacher_id=teacher
      and cs.institution_id=inst
      and c.institution_id=inst
      and c.status='active'
      and su.institution_id=inst
      and su.status='active'
  ) then
    raise exception 'A disciplina não está vinculada a esta turma para você.';
  end if;

  for item in select * from jsonb_array_elements(coalesce(_rows,'[]'::jsonb)) loop
    student:=(item->>'student_id')::uuid;
    stat:=coalesce(item->>'status','present');
    note_text:=coalesce(item->>'note','');

    if stat not in ('present','absent','late','excused') then
      raise exception 'Situação de frequência inválida';
    end if;

    if exists(
      select 1
      from public.students s
      where s.id=student
        and s.classroom_id=_classroom_id
        and s.institution_id=inst
    ) then
      insert into public.attendance_records(
        institution_id,classroom_id,student_id,teacher_id,subject_id,attendance_date,status,note,updated_at
      )
      values(inst,_classroom_id,student,teacher,_subject_id,_date,stat,nullif(note_text,''),now())
      on conflict(student_id,attendance_date,subject_id)
      do update set
        classroom_id=excluded.classroom_id,
        teacher_id=excluded.teacher_id,
        status=excluded.status,
        note=excluded.note,
        updated_at=now();

      total:=total+1;
    end if;
  end loop;

  return total;
end;
$function$;
