-- SINA: complete the classroom/subject/teacher relationship.
-- The responsibility model supports one primary teacher plus optional additional
-- teachers. The legacy unique(classroom_id, subject_id) constraint prevented that
-- model from working and allowed teacher assignment writes to replace another
-- teacher silently.

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname
  INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.classroom_subjects'::regclass
    AND contype = 'u'
    AND conkey = ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid='public.classroom_subjects'::regclass AND attname='classroom_id' AND NOT attisdropped),
      (SELECT attnum FROM pg_attribute WHERE attrelid='public.classroom_subjects'::regclass AND attname='subject_id' AND NOT attisdropped)
    ]::smallint[]
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.classroom_subjects DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS classroom_subjects_teacher_unique_idx
  ON public.classroom_subjects (classroom_id, subject_id, teacher_id);

CREATE INDEX IF NOT EXISTS classroom_subjects_primary_lookup_idx
  ON public.classroom_subjects (institution_id, classroom_id, subject_id, is_primary)
  WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.teacher_assign_subject_to_class(
  _subject_id uuid,
  _classroom_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inst uuid;
  v_row_id uuid;
  v_existing_teacher uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a professores.';
  END IF;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subjects
    WHERE id = _subject_id
      AND institution_id = v_inst
      AND status = 'active'
      AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'A disciplina não pertence a você ou está indisponível.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classrooms c
    JOIN public.classroom_teachers ct
      ON ct.classroom_id = c.id
     AND ct.user_id = auth.uid()
    WHERE c.id = _classroom_id
      AND c.institution_id = v_inst
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'A turma não pertence a você.';
  END IF;

  SELECT cs.id, cs.teacher_id
  INTO v_row_id, v_existing_teacher
  FROM public.classroom_subjects cs
  WHERE cs.classroom_id = _classroom_id
    AND cs.subject_id = _subject_id
    AND cs.institution_id = v_inst
  ORDER BY cs.is_primary DESC, cs.created_at
  LIMIT 1;

  IF v_row_id IS NOT NULL THEN
    IF v_existing_teacher = auth.uid() THEN
      RETURN v_row_id;
    END IF;

    RAISE EXCEPTION 'Esta disciplina já está vinculada a outro professor. A alteração do responsável deve ser feita pelo administrador.';
  END IF;

  INSERT INTO public.classroom_subjects(
    institution_id, classroom_id, subject_id, teacher_id, is_primary
  )
  VALUES (
    v_inst, _classroom_id, _subject_id, auth.uid(), true
  )
  RETURNING id INTO v_row_id;

  RETURN v_row_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_assign_subject_to_class(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_assign_subject_to_class(uuid,uuid) TO authenticated;
