-- SINA Prioridade 2: frequência com integridade e relatório por disciplina.
-- A frequência acadêmica é sempre específica de uma disciplina.
ALTER TABLE public.attendance_records
  ALTER COLUMN subject_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_records_teacher_subject_date_idx
  ON public.attendance_records (institution_id, classroom_id, subject_id, attendance_date DESC);

CREATE OR REPLACE FUNCTION public.teacher_get_attendance_report(
  _classroom_id uuid,
  _subject_id uuid
)
RETURNS TABLE(
  student_id uuid,
  student_name text,
  enrollment text,
  total_records bigint,
  present_count bigint,
  absent_count bigint,
  late_count bigint,
  excused_count bigint,
  attendance_percent numeric,
  last_attendance_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    s.id,
    s.full_name,
    s.enrollment,
    count(ar.id)::bigint,
    count(ar.id) FILTER (WHERE ar.status = 'present')::bigint,
    count(ar.id) FILTER (WHERE ar.status = 'absent')::bigint,
    count(ar.id) FILTER (WHERE ar.status = 'late')::bigint,
    count(ar.id) FILTER (WHERE ar.status = 'excused')::bigint,
    CASE
      WHEN count(ar.id) = 0 THEN NULL
      ELSE round(
        (
          count(ar.id) FILTER (WHERE ar.status IN ('present','late'))::numeric
          / count(ar.id)::numeric
        ) * 100,
        1
      )
    END,
    max(ar.attendance_date)
  FROM public.students s
  JOIN public.classroom_teachers ct
    ON ct.classroom_id = s.classroom_id
   AND ct.user_id = auth.uid()
  JOIN public.classroom_subjects cs
    ON cs.classroom_id = s.classroom_id
   AND cs.subject_id = _subject_id
   AND cs.teacher_id = auth.uid()
   AND cs.institution_id = s.institution_id
  LEFT JOIN public.attendance_records ar
    ON ar.student_id = s.id
   AND ar.classroom_id = _classroom_id
   AND ar.subject_id = _subject_id
   AND ar.institution_id = s.institution_id
  WHERE s.classroom_id = _classroom_id
    AND s.institution_id = sina_private.current_institution('teacher'::public.app_role)
  GROUP BY s.id, s.full_name, s.enrollment
  ORDER BY s.full_name;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_get_attendance_report(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_get_attendance_report(uuid,uuid) TO authenticated;
