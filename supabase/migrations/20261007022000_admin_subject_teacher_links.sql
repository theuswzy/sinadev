-- SINA: complete admin management of teacher/subject links.
-- Admins can add an additional teacher, promote a linked teacher to primary,
-- or remove a link without leaving orphaned classroom membership.

CREATE OR REPLACE FUNCTION public.admin_set_subject_teacher_link(
  _classroom_id uuid,
  _subject_id uuid,
  _teacher_id uuid,
  _is_primary boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_existing_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE id = _classroom_id AND institution_id = v_institution AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Turma não encontrada nesta instituição.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subjects
    WHERE id = _subject_id AND institution_id = v_institution AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Disciplina não encontrada nesta instituição.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classroom_teachers ct
    WHERE ct.classroom_id = _classroom_id
      AND ct.user_id = _teacher_id
      AND ct.institution_id = v_institution
  ) THEN
    RAISE EXCEPTION 'O professor precisa estar vinculado à turma antes de ser vinculado à disciplina.';
  END IF;

  SELECT cs.id INTO v_existing_id
  FROM public.classroom_subjects cs
  WHERE cs.institution_id = v_institution
    AND cs.classroom_id = _classroom_id
    AND cs.subject_id = _subject_id
    AND cs.teacher_id = _teacher_id
  LIMIT 1;

  IF _is_primary THEN
    UPDATE public.classroom_subjects
    SET is_primary = false
    WHERE institution_id = v_institution
      AND classroom_id = _classroom_id
      AND subject_id = _subject_id;
  END IF;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.classroom_subjects(
      institution_id, classroom_id, subject_id, teacher_id, is_primary
    )
    VALUES (
      v_institution, _classroom_id, _subject_id, _teacher_id, _is_primary
    );
  ELSE
    UPDATE public.classroom_subjects
    SET is_primary = _is_primary
    WHERE id = v_existing_id;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_subject_teacher_link(
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
  v_id uuid;
  v_is_primary boolean;
  v_other_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  SELECT cs.id, cs.is_primary
  INTO v_id, v_is_primary
  FROM public.classroom_subjects cs
  WHERE cs.institution_id = v_institution
    AND cs.classroom_id = _classroom_id
    AND cs.subject_id = _subject_id
    AND cs.teacher_id = _teacher_id
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer
  INTO v_other_count
  FROM public.classroom_subjects cs
  WHERE cs.institution_id = v_institution
    AND cs.classroom_id = _classroom_id
    AND cs.subject_id = _subject_id
    AND cs.teacher_id <> _teacher_id;

  IF v_is_primary AND v_other_count > 0 THEN
    RAISE EXCEPTION 'Transfira a responsabilidade para outro professor antes de remover o responsável atual.';
  END IF;

  DELETE FROM public.classroom_subjects WHERE id = v_id;
  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_subject_teacher_link(uuid,uuid,uuid,boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_remove_subject_teacher_link(uuid,uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_subject_teacher_link(uuid,uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_subject_teacher_link(uuid,uuid,uuid) TO authenticated;


-- Protect the relationship from any direct classroom-teacher removal path.
-- Cascading deletes (for example when a classroom itself is deleted) are allowed
-- to proceed; explicit membership removal must clear subject links first.
CREATE OR REPLACE FUNCTION public.guard_classroom_teacher_subject_links()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF pg_trigger_depth() = 1
     AND EXISTS (
       SELECT 1
       FROM public.classroom_subjects cs
       WHERE cs.classroom_id = OLD.classroom_id
         AND cs.teacher_id = OLD.user_id
         AND cs.institution_id = OLD.institution_id
     )
  THEN
    RAISE EXCEPTION 'Não é possível desvincular o professor da turma enquanto ele estiver vinculado a uma disciplina. Remova ou transfira os vínculos das disciplinas primeiro.';
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_classroom_teacher_subject_links
ON public.classroom_teachers;

CREATE TRIGGER trg_guard_classroom_teacher_subject_links
BEFORE DELETE ON public.classroom_teachers
FOR EACH ROW
EXECUTE FUNCTION public.guard_classroom_teacher_subject_links();


-- Keep the student subject list one row per discipline even when multiple
-- teachers are linked to the same classroom/subject.
CREATE OR REPLACE FUNCTION public.student_list_subjects()
RETURNS TABLE(
  id uuid,
  name text,
  code text,
  classroom_id uuid,
  classroom_name text,
  teacher_id uuid,
  teacher_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id,
    s.name,
    s.code,
    c.id,
    c.name,
    cs.teacher_id,
    COALESCE(NULLIF(trim(p.display_name), ''), '')
  FROM public.classrooms c
  JOIN public.students st
    ON st.classroom_id = c.id
   AND st.user_id = auth.uid()
   AND st.institution_id = c.institution_id
  JOIN LATERAL (
    SELECT cs.*
    FROM public.classroom_subjects cs
    WHERE cs.institution_id = c.institution_id
      AND cs.classroom_id = c.id
      AND cs.subject_id IN (
        SELECT s2.id
        FROM public.subjects s2
        WHERE s2.institution_id = c.institution_id
          AND s2.status = 'active'
      )
    ORDER BY cs.is_primary DESC, cs.created_at ASC, cs.id
    LIMIT 1
  ) cs ON true
  JOIN public.subjects s
    ON s.id = cs.subject_id
   AND s.institution_id = c.institution_id
   AND s.status = 'active'
  LEFT JOIN public.profiles p ON p.user_id = cs.teacher_id
  WHERE c.id = st.classroom_id
    AND c.institution_id = sina_private.current_institution('student'::public.app_role)
    AND c.status = 'active'
  ORDER BY s.name;
$$;

REVOKE EXECUTE ON FUNCTION public.student_list_subjects() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.student_list_subjects() TO authenticated;
