-- SINA: keep teacher/classroom membership consistent with subject assignments.
-- A teacher cannot leave a classroom while still assigned to one of its subjects;
-- otherwise the school could retain a responsible teacher who no longer belongs
-- to the class.

CREATE OR REPLACE FUNCTION public.teacher_leave_classroom(_classroom_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_inst uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a professores.';
  END IF;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.classroom_subjects cs
    WHERE cs.classroom_id = _classroom_id
      AND cs.institution_id = v_inst
      AND cs.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Não é possível sair da turma enquanto você estiver vinculado a uma disciplina. Peça ao administrador para ajustar o vínculo primeiro.';
  END IF;

  DELETE FROM public.classroom_teachers ct
  USING public.classrooms c
  WHERE ct.classroom_id = _classroom_id
    AND ct.user_id = auth.uid()
    AND c.id = ct.classroom_id
    AND c.institution_id = v_inst;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_unassign_subject_from_class(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_inst uuid;
  v_primary boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a professores.';
  END IF;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  SELECT cs.is_primary
  INTO v_primary
  FROM public.classroom_subjects cs
  WHERE cs.id = _id
    AND cs.teacher_id = auth.uid()
    AND cs.institution_id = v_inst;

  IF v_primary IS NULL THEN
    RETURN false;
  END IF;

  IF v_primary THEN
    RAISE EXCEPTION 'A disciplina está sob sua responsabilidade. O administrador deve transferir ou encerrar esse vínculo antes da remoção.';
  END IF;

  DELETE FROM public.classroom_subjects
  WHERE id = _id
    AND teacher_id = auth.uid()
    AND institution_id = v_inst;

  RETURN FOUND;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_leave_classroom(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_leave_classroom(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_unassign_subject_from_class(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_unassign_subject_from_class(uuid) TO authenticated;
