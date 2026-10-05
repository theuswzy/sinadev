-- Teacher gradebook v2: one request for the full class/subject/period grid.
-- Keeps authorization and tenant isolation on the database side.

CREATE OR REPLACE FUNCTION public.teacher_get_gradebook(
  _classroom_id uuid,
  _subject_id uuid,
  _period integer
)
RETURNS TABLE(
  student_id uuid,
  full_name text,
  enrollment text,
  score numeric,
  absences integer,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_subject_name text;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.classroom_teachers ct
    JOIN public.classrooms c ON c.id = ct.classroom_id
    WHERE ct.classroom_id = _classroom_id
      AND ct.user_id = auth.uid()
      AND c.institution_id = v_institution
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'A turma não pertence a este professor.';
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

  RETURN QUERY
  SELECT
    s.id,
    s.full_name,
    s.enrollment,
    COALESCE(g.score, legacy_g.score) AS score,
    COALESCE(g.absences, legacy_g.absences, 0) AS absences,
    GREATEST(
      COALESCE(g.updated_at, 'epoch'::timestamptz),
      COALESCE(legacy_g.updated_at, 'epoch'::timestamptz)
    ) AS updated_at
  FROM public.students s
  LEFT JOIN public.grades g
    ON g.student_id = s.id
   AND g.institution_id = v_institution
   AND g.period = _period
   AND g.subject_id = _subject_id
  LEFT JOIN public.grades legacy_g
    ON legacy_g.student_id = s.id
   AND legacy_g.institution_id = v_institution
   AND legacy_g.period = _period
   AND legacy_g.subject_id IS NULL
   AND lower(trim(legacy_g.subject)) = lower(trim(v_subject_name))
  WHERE s.institution_id = v_institution
    AND s.classroom_id = _classroom_id
  ORDER BY lower(s.full_name), s.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_bulk_upsert_grades_v2(
  _classroom_id uuid,
  _subject_id uuid,
  _period integer,
  _rows jsonb
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
  item jsonb;
  v_student uuid;
  v_score numeric;
  v_absences integer;
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

  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'Nenhuma nota foi informada.';
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

  FOR item IN SELECT value FROM jsonb_array_elements(_rows)
  LOOP
    v_student := NULLIF(item->>'student_id', '')::uuid;
    v_score := NULLIF(item->>'score', '')::numeric;
    v_absences := COALESCE(NULLIF(item->>'absences', '')::integer, 0);

    IF v_student IS NULL OR v_score IS NULL OR v_score < 0 OR v_score > 10 THEN
      RAISE EXCEPTION 'Existe uma nota inválida no lote.';
    END IF;

    IF v_absences < 0 THEN
      RAISE EXCEPTION 'Quantidade de faltas inválida.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = v_student
        AND s.institution_id = v_institution
        AND s.classroom_id = _classroom_id
    ) THEN
      RAISE EXCEPTION 'Um dos alunos não pertence a esta turma.';
    END IF;

    INSERT INTO public.grades(
      student_id,
      subject,
      period,
      score,
      absences,
      institution_id,
      subject_id,
      teacher_id
    )
    VALUES(
      v_student,
      trim(v_subject_name),
      _period,
      v_score,
      v_absences,
      v_institution,
      _subject_id,
      auth.uid()
    )
    ON CONFLICT (student_id, subject, period)
    DO UPDATE SET
      score = excluded.score,
      absences = excluded.absences,
      institution_id = excluded.institution_id,
      subject_id = excluded.subject_id,
      teacher_id = excluded.teacher_id,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_get_gradebook(uuid, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.teacher_get_gradebook(uuid, uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_bulk_upsert_grades_v2(uuid, uuid, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.teacher_bulk_upsert_grades_v2(uuid, uuid, integer, jsonb) TO authenticated;
