CREATE OR REPLACE FUNCTION public.teacher_get_class_report(_classroom_id uuid)
RETURNS TABLE(student_id uuid, student_name text, enrollment text, attendance_percent numeric, grade_average numeric, assessment_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    s.id,
    s.full_name,
    s.enrollment,
    COALESCE(
      ar.attendance_percent,
      s.attendance
    )::numeric,
    COALESCE(g.grade_average, 0)::numeric,
    COALESCE(a.assessment_count, 0)::bigint
  FROM public.students s
  JOIN public.classroom_teachers ct
    ON ct.classroom_id = s.classroom_id
   AND ct.user_id = auth.uid()
  JOIN public.classrooms c
    ON c.id = s.classroom_id
   AND c.institution_id = s.institution_id
   AND c.status = 'active'
  LEFT JOIN LATERAL (
    SELECT round(
      count(*) FILTER (WHERE r.status IN ('present','late'))::numeric
      / NULLIF(count(r.id), 0) * 100,
      1
    ) AS attendance_percent
    FROM public.attendance_records r
    WHERE r.student_id = s.id
      AND r.classroom_id = _classroom_id
      AND r.institution_id = s.institution_id
  ) ar ON true
  LEFT JOIN LATERAL (
    SELECT round(avg(gr.score), 2) AS grade_average
    FROM public.grades gr
    WHERE gr.student_id = s.id
      AND gr.institution_id = s.institution_id
  ) g ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS assessment_count
    FROM public.assessment_scores sc
    JOIN public.assessments ass ON ass.id = sc.assessment_id
    WHERE sc.student_id = s.id
      AND ass.classroom_id = _classroom_id
      AND ass.institution_id = s.institution_id
  ) a ON true
  WHERE s.classroom_id = _classroom_id
    AND s.institution_id = sina_private.current_institution('teacher'::public.app_role)
  ORDER BY s.full_name;
$function$;