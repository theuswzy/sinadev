-- SINA: harden teacher assessment writes against classroom/subject tenant drift.
-- Assessments follow the same classroom membership + subject assignment rules
-- as the rest of the teacher workspace.

CREATE OR REPLACE FUNCTION public.teacher_create_assessment(
  _classroom_id uuid,
  _subject_id uuid,
  _term_id uuid,
  _title text,
  _type text,
  _weight numeric,
  _max_score numeric,
  _due_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inst uuid;
  v_assessment_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao professor.';
  END IF;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF _classroom_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.classrooms c
    JOIN public.classroom_teachers ct
      ON ct.classroom_id = c.id
     AND ct.user_id = auth.uid()
    WHERE c.id = _classroom_id
      AND c.institution_id = v_inst
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'A turma selecionada não pertence a você.';
  END IF;

  IF nullif(trim(_title), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o título da avaliação.';
  END IF;

  IF _max_score IS NULL OR _max_score <= 0 OR _weight IS NULL OR _weight <= 0 THEN
    RAISE EXCEPTION 'Peso e nota máxima devem ser maiores que zero.';
  END IF;

  IF _subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.classroom_subjects cs
    JOIN public.subjects su ON su.id = cs.subject_id
    WHERE cs.classroom_id = _classroom_id
      AND cs.subject_id = _subject_id
      AND cs.teacher_id = auth.uid()
      AND cs.institution_id = v_inst
      AND su.institution_id = v_inst
      AND su.status = 'active'
  ) THEN
    RAISE EXCEPTION 'A disciplina não está vinculada a esta turma para você.';
  END IF;

  IF _term_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.academic_terms t
    WHERE t.id = _term_id
      AND t.institution_id = v_inst
  ) THEN
    RAISE EXCEPTION 'Período acadêmico inválido.';
  END IF;

  INSERT INTO public.assessments(
    institution_id, classroom_id, subject_id, term_id, teacher_id,
    title, assessment_type, weight, max_score, due_at
  )
  VALUES(
    v_inst, _classroom_id, _subject_id, _term_id, auth.uid(),
    trim(_title),
    coalesce(nullif(trim(_type), ''), 'prova'),
    _weight,
    _max_score,
    _due_at
  )
  RETURNING id INTO v_assessment_id;

  RETURN v_assessment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_upsert_assessment_score(
  _assessment_id uuid,
  _student_id uuid,
  _score numeric,
  _feedback text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inst uuid;
  v_max_score numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao professor.';
  END IF;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  SELECT a.max_score
  INTO v_max_score
  FROM public.assessments a
  JOIN public.classroom_teachers ct
    ON ct.classroom_id = a.classroom_id
   AND ct.user_id = auth.uid()
  WHERE a.id = _assessment_id
    AND a.teacher_id = auth.uid()
    AND a.institution_id = v_inst
    AND a.status <> 'archived';

  IF v_max_score IS NULL THEN
    RAISE EXCEPTION 'Avaliação não encontrada ou sem permissão.';
  END IF;

  IF _score IS NOT NULL AND (_score < 0 OR _score > v_max_score) THEN
    RAISE EXCEPTION 'A nota deve estar entre 0 e a nota máxima da avaliação.';
  END IF;

  IF _feedback IS NOT NULL AND char_length(_feedback) > 5000 THEN
    RAISE EXCEPTION 'O feedback excede o limite permitido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students st
    JOIN public.classrooms c ON c.id = st.classroom_id
    WHERE st.id = _student_id
      AND st.classroom_id = (SELECT classroom_id FROM public.assessments WHERE id = _assessment_id)
      AND st.institution_id = v_inst
      AND c.institution_id = v_inst
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Aluno inválido para esta avaliação.';
  END IF;

  INSERT INTO public.assessment_scores(
    assessment_id, student_id, score, feedback,
    graded_at, graded_by, submitted_at, updated_at
  )
  VALUES(
    _assessment_id, _student_id, _score, _feedback,
    CASE WHEN _score IS NULL THEN NULL ELSE now() END,
    CASE WHEN _score IS NULL THEN NULL ELSE auth.uid() END,
    now(), now()
  )
  ON CONFLICT (assessment_id, student_id)
  DO UPDATE SET
    score = excluded.score,
    feedback = excluded.feedback,
    graded_at = excluded.graded_at,
    graded_by = excluded.graded_by,
    updated_at = now();

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_create_assessment(uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_create_assessment(uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) TO authenticated;
