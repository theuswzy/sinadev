-- Academic period closing: tenant-safe lock for official gradebook changes.
-- Closed periods remain readable for students, teachers and administrators.
-- Only institution administrators can close/reopen a period.

CREATE TABLE IF NOT EXISTS public.academic_period_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  period integer NOT NULL CHECK (period BETWEEN 1 AND 4),
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, period)
);

CREATE INDEX IF NOT EXISTS academic_period_locks_institution_idx
  ON public.academic_period_locks (institution_id, period);

CREATE TABLE IF NOT EXISTS public.academic_period_lock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  period integer NOT NULL CHECK (period BETWEEN 1 AND 4),
  action text NOT NULL CHECK (action IN ('closed','reopened')),
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_period_lock_audit_institution_time_idx
  ON public.academic_period_lock_audit (institution_id, changed_at DESC);

ALTER TABLE public.academic_period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_period_lock_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.academic_period_locks FROM public, anon, authenticated;
REVOKE ALL ON public.academic_period_lock_audit FROM public, anon, authenticated;
GRANT SELECT ON public.academic_period_locks TO authenticated;
GRANT SELECT ON public.academic_period_lock_audit TO authenticated;

DROP POLICY IF EXISTS "Admins read academic period locks" ON public.academic_period_locks;
CREATE POLICY "Admins read academic period locks"
ON public.academic_period_locks
FOR SELECT TO authenticated
USING (
  institution_id = sina_private.current_institution('admin'::public.app_role)
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins read academic period lock audit" ON public.academic_period_lock_audit;
CREATE POLICY "Admins read academic period lock audit"
ON public.academic_period_lock_audit
FOR SELECT TO authenticated
USING (
  institution_id = sina_private.current_institution('admin'::public.app_role)
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION sina_private.academic_period_is_open(
  _institution_id uuid,
  _period integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT _period BETWEEN 1 AND 4
    AND NOT EXISTS (
      SELECT 1
      FROM public.academic_period_locks l
      WHERE l.institution_id = _institution_id
        AND l.period = _period
    );
$function$;

CREATE OR REPLACE FUNCTION sina_private.assert_academic_period_open(
  _institution_id uuid,
  _period integer
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT sina_private.academic_period_is_open(_institution_id, _period) THEN
    RAISE EXCEPTION 'O período acadêmico está encerrado. Solicite ao administrador a reabertura para corrigir notas.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_get_gradebook_period_status(_period integer)
RETURNS TABLE(period integer, is_closed boolean, closed_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores autorizados.';
  END IF;

  v_institution := sina_private.current_institution('teacher'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF _period < 1 OR _period > 4 THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  RETURN QUERY
  SELECT _period, l.id IS NOT NULL, l.closed_at
  FROM (SELECT 1) x
  LEFT JOIN public.academic_period_locks l
    ON l.institution_id = v_institution
   AND l.period = _period;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_academic_period_locks()
RETURNS TABLE(period integer, is_closed boolean, closed_at timestamptz, closed_by uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  RETURN QUERY
  SELECT p.period, l.id IS NOT NULL, l.closed_at, l.closed_by
  FROM generate_series(1,4) AS p(period)
  LEFT JOIN public.academic_period_locks l
    ON l.institution_id = v_institution
   AND l.period = p.period
  ORDER BY p.period;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_academic_period_lock(
  _period integer,
  _closed boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_existing boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  IF _period < 1 OR _period > 4 THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.academic_period_locks
    WHERE institution_id = v_institution AND period = _period
  ) INTO v_existing;

  IF _closed THEN
    INSERT INTO public.academic_period_locks (institution_id, period, closed_at, closed_by, updated_at)
    VALUES (v_institution, _period, now(), auth.uid(), now())
    ON CONFLICT (institution_id, period)
    DO UPDATE SET closed_at = now(), closed_by = auth.uid(), updated_at = now();

    INSERT INTO public.academic_period_lock_audit (institution_id, period, action, changed_by)
    VALUES (v_institution, _period, 'closed', auth.uid());

    RETURN true;
  END IF;

  DELETE FROM public.academic_period_locks
  WHERE institution_id = v_institution
    AND period = _period;

  IF v_existing THEN
    INSERT INTO public.academic_period_lock_audit (institution_id, period, action, changed_by)
    VALUES (v_institution, _period, 'reopened', auth.uid());
  END IF;

  RETURN true;
END;
$function$;

-- Re-declare the gradebook write APIs with the period guard.
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

  PERFORM sina_private.assert_academic_period_open(v_institution, _period);

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

    INSERT INTO public.grades (
      student_id, subject, period, score, absences,
      institution_id, subject_id, teacher_id
    )
    VALUES (
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

-- The correction API must obey the same lock, including direct calls.
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
  item jsonb;
  v_student uuid;
  v_absences integer;
  v_count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores autorizados.';
  END IF;

  v_institution := sina_private.current_institution('teacher'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF _classroom_id IS NULL OR _subject_id IS NULL OR _period < 1 OR _period > 4 THEN
    RAISE EXCEPTION 'Turma, disciplina ou período inválido.';
  END IF;

  PERFORM sina_private.assert_academic_period_open(v_institution, _period);

  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN
    RAISE EXCEPTION 'Nenhuma correção foi informada.';
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

  FOR item IN SELECT value FROM jsonb_array_elements(_rows)
  LOOP
    v_student := NULLIF(item->>'student_id', '')::uuid;
    v_absences := COALESCE(NULLIF(item->>'absences', '')::integer, 0);

    IF v_student IS NULL OR v_absences < 0 THEN
      RAISE EXCEPTION 'Dados de correção inválidos.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student
        AND s.institution_id = v_institution
        AND s.classroom_id = _classroom_id
    ) THEN
      RAISE EXCEPTION 'Um dos alunos não pertence a esta turma.';
    END IF;

    UPDATE public.grades
    SET score = NULL,
        absences = v_absences,
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
      );

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.teacher_get_gradebook_period_status(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_get_gradebook_period_status(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_academic_period_locks() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_academic_period_locks() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_academic_period_lock(integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_academic_period_lock(integer, boolean) TO authenticated;
