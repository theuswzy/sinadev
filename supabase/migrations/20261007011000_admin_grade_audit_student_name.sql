-- Add the student display name to the administrative grade audit read model.
DROP FUNCTION IF EXISTS public.admin_list_grade_change_audit(integer);

CREATE FUNCTION public.admin_list_grade_change_audit(_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  grade_id uuid,
  student_id uuid,
  student_name text,
  subject_id uuid,
  subject text,
  period integer,
  action text,
  changed_by uuid,
  changed_at timestamptz,
  old_score numeric,
  new_score numeric,
  old_absences integer,
  new_absences integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Instituição administrativa não encontrada.';
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.grade_id, a.student_id, s.full_name, a.subject_id, a.subject, a.period,
    a.action, a.changed_by, a.changed_at,
    a.old_score, a.new_score, a.old_absences, a.new_absences
  FROM public.grade_change_audit a
  LEFT JOIN public.students s ON s.id = a.student_id AND s.institution_id = v_institution
  WHERE a.institution_id = v_institution
  ORDER BY a.changed_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_grade_change_audit(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_grade_change_audit(integer) TO authenticated;
