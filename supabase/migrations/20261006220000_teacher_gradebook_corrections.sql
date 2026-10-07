-- Allow teachers to explicitly clear an existing official grade.
-- Clearing the score preserves the attendance value and the grade row metadata.
-- Authorization remains tenant- and classroom/subject-scoped in the database.

CREATE OR REPLACE FUNCTION public.teacher_clear_gradebook_scores(
  _classroom_id uuid,
  _subject_id uuid,
  _period integer,
  _student_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_subject_name text;
  v_count integer := 0;
  v_student uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores autorizados.';
  END IF;

  v_institution := sina_private.current_institution('teacher'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF _classroom_id IS NULL OR _subject_id IS NULL THEN
    RAISE EXCEPTION 'Selecione turma e disciplina.';
  END IF;

  IF _period < 1 OR _period > 4 THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  IF _student_ids IS NULL OR cardinality(_student_ids) = 0 THEN
    RETURN 0;
  END IF;

  SELECT su.name
  INTO v_subject_name
  FROM public.classroom_subjects cs
  JOIN public.subjects su ON su.id = cs.subject_id
  WHERE cs.classroom_id = _classroom_id
    AND cs.subject_id = _subject_id
    AND cs.teacher_id = auth.uid()
    AND cs.institution_id = v_institution
    AND su.institution_id = v_institution
    AND su.status = 'active'
  LIMIT 1;

  IF v_subject_name IS NULL THEN
    RAISE EXCEPTION 'A disciplina não está vinculada a esta turma para você.';
  END IF;

  FOREACH v_student IN ARRAY _student_ids
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = v_student
        AND s.institution_id = v_institution
        AND s.classroom_id = _classroom_id
    ) THEN
      RAISE EXCEPTION 'Um dos alunos não pertence a esta turma.';
    END IF;

    UPDATE public.grades
    SET score = NULL,
        subject = trim(v_subject_name),
        institution_id = v_institution,
        subject_id = _subject_id,
        teacher_id = auth.uid(),
        updated_at = now()
    WHERE student_id = v_student
      AND institution_id = v_institution
      AND period = _period
      AND subject_id = _subject_id;

    v_count := v_count + CASE WHEN FOUND THEN 1 ELSE 0 END;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_clear_gradebook_scores(uuid, uuid, integer, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.teacher_clear_gradebook_scores(uuid, uuid, integer, uuid[]) TO authenticated;
