-- Explicit responsible teacher for each classroom/subject.
-- Multiple teacher links remain supported; only one can be marked responsible.

ALTER TABLE public.classroom_subjects
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Preserve the current effective teacher as responsible where possible.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY institution_id, classroom_id, subject_id
      ORDER BY CASE WHEN teacher_id IS NULL THEN 1 ELSE 0 END, created_at NULLS LAST, id
    ) AS rn
  FROM public.classroom_subjects
)
UPDATE public.classroom_subjects cs
SET is_primary = true
FROM ranked r
WHERE cs.id = r.id
  AND r.rn = 1;

CREATE UNIQUE INDEX IF NOT EXISTS classroom_subjects_one_primary_idx
  ON public.classroom_subjects (institution_id, classroom_id, subject_id)
  WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.admin_list_subject_teacher_matrix()
RETURNS TABLE(
  id uuid,
  classroom_id uuid,
  classroom_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text,
  teacher_email text,
  is_primary boolean,
  teacher_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    cs.classroom_id,
    c.name,
    cs.subject_id,
    s.name,
    cs.teacher_id,
    COALESCE(NULLIF(trim(p.full_name), ''), 'Professor sem nome'),
    p.email,
    cs.is_primary,
    COUNT(*) OVER (PARTITION BY cs.institution_id, cs.classroom_id, cs.subject_id)
  FROM public.classroom_subjects cs
  JOIN public.classrooms c
    ON c.id = cs.classroom_id
   AND c.institution_id = v_institution
  JOIN public.subjects s
    ON s.id = cs.subject_id
   AND s.institution_id = v_institution
  LEFT JOIN public.profiles p
    ON p.user_id = cs.teacher_id
  WHERE cs.institution_id = v_institution
  ORDER BY lower(c.name), lower(s.name), cs.is_primary DESC, lower(COALESCE(p.full_name, ''));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_subject_responsible(
  _classroom_id uuid,
  _subject_id uuid,
  _teacher_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classrooms c
    WHERE c.id = _classroom_id
      AND c.institution_id = v_institution
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Turma não encontrada nesta instituição.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subjects s
    WHERE s.id = _subject_id
      AND s.institution_id = v_institution
      AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Disciplina não encontrada nesta instituição.';
  END IF;

  IF _teacher_id IS NULL THEN
    UPDATE public.classroom_subjects
    SET is_primary = false
    WHERE institution_id = v_institution
      AND classroom_id = _classroom_id
      AND subject_id = _subject_id;
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classroom_teachers ct
    WHERE ct.classroom_id = _classroom_id
      AND ct.user_id = _teacher_id
      AND ct.institution_id = v_institution
  ) THEN
    RAISE EXCEPTION 'O professor precisa estar vinculado à turma antes de assumir a disciplina.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classroom_subjects cs
    WHERE cs.classroom_id = _classroom_id
      AND cs.subject_id = _subject_id
      AND cs.teacher_id = _teacher_id
      AND cs.institution_id = v_institution
  ) THEN
    INSERT INTO public.classroom_subjects(
      institution_id, classroom_id, subject_id, teacher_id, is_primary
    )
    VALUES (
      v_institution, _classroom_id, _subject_id, _teacher_id, true
    );
  ELSE
    UPDATE public.classroom_subjects
    SET is_primary = false
    WHERE institution_id = v_institution
      AND classroom_id = _classroom_id
      AND subject_id = _subject_id;

    UPDATE public.classroom_subjects
    SET is_primary = true
    WHERE institution_id = v_institution
      AND classroom_id = _classroom_id
      AND subject_id = _subject_id
      AND teacher_id = _teacher_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_subject_teacher_matrix() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_subject_teacher_matrix() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_subject_responsible(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_subject_responsible(uuid, uuid, uuid) TO authenticated;
