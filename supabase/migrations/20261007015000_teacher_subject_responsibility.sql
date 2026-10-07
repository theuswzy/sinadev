CREATE OR REPLACE FUNCTION public.teacher_list_subject_responsibilities()
RETURNS TABLE(
  classroom_id uuid,
  classroom_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text,
  is_primary boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores.';
  END IF;
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  RETURN QUERY
  SELECT
    cs.classroom_id,
    c.name,
    cs.subject_id,
    s.name,
    cs.teacher_id,
    COALESCE(NULLIF(trim(p.full_name), ''), 'Professor'),
    cs.is_primary
  FROM public.classroom_subjects cs
  JOIN public.classrooms c ON c.id = cs.classroom_id AND c.institution_id = v_institution
  JOIN public.subjects s ON s.id = cs.subject_id AND s.institution_id = v_institution
  LEFT JOIN public.profiles p ON p.user_id = cs.teacher_id
  JOIN public.classroom_teachers ct
    ON ct.classroom_id = cs.classroom_id
   AND ct.user_id = auth.uid()
  WHERE cs.institution_id = v_institution
    AND cs.teacher_id = auth.uid()
    AND c.status = 'active'
    AND s.status = 'active'
  ORDER BY lower(c.name), lower(s.name);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_list_subject_responsibilities() FROM public;
GRANT EXECUTE ON FUNCTION public.teacher_list_subject_responsibilities() TO authenticated;
