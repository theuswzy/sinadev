-- SINA: restore academic-period locking after responsibility write guards.
-- Every official grade write path must honor the institution's closed-period lock.

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
  v_existing_teacher uuid;
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

  PERFORM sina_private.assert_academic_period_open(v_institution, _period);

  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'Nenhuma nota foi informada.';
  END IF;

  IF NOT sina_private.teacher_is_primary_subject_teacher(_classroom_id, _subject_id) THEN
    RAISE EXCEPTION 'Somente o professor responsável pode lançar ou alterar as notas oficiais desta disciplina.';
  END IF;

  SELECT su.name INTO v_subject_name
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
      SELECT 1 FROM public.students s
      WHERE s.id = v_student
        AND s.institution_id = v_institution
        AND s.classroom_id = _classroom_id
    ) THEN
      RAISE EXCEPTION 'Um dos alunos não pertence a esta turma.';
    END IF;

    SELECT g.teacher_id INTO v_existing_teacher
    FROM public.grades g
    WHERE g.student_id = v_student
      AND g.institution_id = v_institution
      AND g.period = _period
      AND (
        g.subject_id = _subject_id
        OR (g.subject_id IS NULL AND lower(trim(g.subject)) = lower(trim(v_subject_name)))
      )
    ORDER BY CASE WHEN g.subject_id = _subject_id THEN 0 ELSE 1 END, g.updated_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF v_existing_teacher IS NOT NULL AND v_existing_teacher <> auth.uid() THEN
      RAISE EXCEPTION 'A nota deste aluno já está sob responsabilidade de outro professor.';
    END IF;

    INSERT INTO public.grades(
      student_id, subject, period, score, absences, institution_id, subject_id, teacher_id
    )
    VALUES(
      v_student, trim(v_subject_name), _period, v_score, v_absences,
      v_institution, _subject_id, auth.uid()
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

CREATE OR REPLACE FUNCTION public.teacher_clear_gradebook_scores(
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
  v_student uuid;
  v_absences integer;
  v_owner uuid;
  item jsonb;
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

  PERFORM sina_private.assert_academic_period_open(v_institution, _period);

  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RETURN 0;
  END IF;

  IF NOT sina_private.teacher_is_primary_subject_teacher(_classroom_id, _subject_id) THEN
    RAISE EXCEPTION 'Somente o professor responsável pode limpar as notas oficiais desta disciplina.';
  END IF;

  SELECT su.name INTO v_subject_name
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
    v_absences := COALESCE(NULLIF(item->>'absences', '')::integer, 0);

    IF v_student IS NULL OR v_absences < 0 THEN
      RAISE EXCEPTION 'Dados inválidos para limpeza da nota.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student
        AND s.institution_id = v_institution
        AND s.classroom_id = _classroom_id
    ) THEN
      RAISE EXCEPTION 'Um dos alunos não pertence a esta turma.';
    END IF;

    SELECT g.teacher_id INTO v_owner
    FROM public.grades g
    WHERE g.student_id = v_student
      AND g.institution_id = v_institution
      AND g.period = _period
      AND (
        g.subject_id = _subject_id
        OR (g.subject_id IS NULL AND lower(trim(g.subject)) = lower(trim(v_subject_name)))
      )
    ORDER BY CASE WHEN g.subject_id = _subject_id THEN 0 ELSE 1 END, g.updated_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF v_owner IS NOT NULL AND v_owner <> auth.uid() THEN
      RAISE EXCEPTION 'A nota deste aluno está sob responsabilidade de outro professor.';
    END IF;

    UPDATE public.grades
    SET score = NULL,
        absences = v_absences,
        subject = trim(v_subject_name),
        institution_id = v_institution,
        subject_id = _subject_id,
        teacher_id = auth.uid(),
        updated_at = now()
    WHERE student_id = v_student
      AND institution_id = v_institution
      AND period = _period
      AND (
        subject_id = _subject_id
        OR (subject_id IS NULL AND lower(trim(subject)) = lower(trim(v_subject_name)))
      )
      AND (teacher_id IS NULL OR teacher_id = auth.uid());

    v_count := v_count + CASE WHEN FOUND THEN 1 ELSE 0 END;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_upsert_grade(
  _student_id uuid,
  _subject text,
  _period integer,
  _score numeric,
  _absences integer
)
RETURNS public.grades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result_row public.grades;
  inst uuid;
  classroom_id uuid;
  subject_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores autorizados.';
  END IF;

  inst := sina_private.current_institution('teacher'::public.app_role);

  IF inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF nullif(trim(_subject),'') IS NULL THEN
    RAISE EXCEPTION 'Informe a disciplina.';
  END IF;

  IF _period < 1 OR _period > 4 OR _score < 0 OR _score > 10 OR _absences < 0 THEN
    RAISE EXCEPTION 'Dados da nota inválidos.';
  END IF;

  PERFORM sina_private.assert_academic_period_open(inst, _period);

  SELECT s.classroom_id INTO classroom_id
  FROM public.students s
  WHERE s.id = _student_id
    AND s.institution_id = inst
    AND EXISTS (
      SELECT 1
      FROM public.classroom_teachers ct
      JOIN public.classrooms c ON c.id = ct.classroom_id
      WHERE ct.classroom_id = s.classroom_id
        AND ct.user_id = auth.uid()
        AND c.institution_id = inst
        AND c.status = 'active'
    );

  IF classroom_id IS NULL THEN
    RAISE EXCEPTION 'Aluno não pertence a uma turma vinculada a este professor.';
  END IF;

  SELECT su.id INTO subject_id
  FROM public.classroom_subjects cs
  JOIN public.subjects su ON su.id = cs.subject_id
  WHERE cs.classroom_id = classroom_id
    AND cs.institution_id = inst
    AND cs.teacher_id = auth.uid()
    AND su.institution_id = inst
    AND su.status = 'active'
    AND lower(su.name) = lower(trim(_subject))
  LIMIT 1;

  IF subject_id IS NULL THEN
    RAISE EXCEPTION 'A disciplina não está vinculada a esta turma para você.';
  END IF;

  IF NOT sina_private.teacher_is_primary_subject_teacher(classroom_id, subject_id) THEN
    RAISE EXCEPTION 'Somente o professor responsável pode lançar a nota oficial desta disciplina.';
  END IF;

  INSERT INTO public.grades(
    student_id, subject, period, score, absences, institution_id, subject_id, teacher_id
  )
  VALUES(
    _student_id, trim(_subject), _period, _score, _absences, inst, subject_id, auth.uid()
  )
  ON CONFLICT(student_id,subject,period)
  DO UPDATE SET
    score = excluded.score,
    absences = excluded.absences,
    institution_id = excluded.institution_id,
    subject_id = excluded.subject_id,
    teacher_id = excluded.teacher_id,
    updated_at = now()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_bulk_upsert_grades_v2(uuid,uuid,integer,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_bulk_upsert_grades_v2(uuid,uuid,integer,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.teacher_clear_gradebook_scores(uuid,uuid,integer,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_clear_gradebook_scores(uuid,uuid,integer,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.teacher_upsert_grade(uuid,text,integer,numeric,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_upsert_grade(uuid,text,integer,numeric,integer) TO authenticated;
