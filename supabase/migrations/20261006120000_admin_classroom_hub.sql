CREATE OR REPLACE FUNCTION public.admin_get_classroom_hub(_classroom_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_classroom public.classrooms%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  SELECT * INTO v_classroom
  FROM public.classrooms c
  WHERE c.id = _classroom_id
    AND c.institution_id = v_institution;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma não encontrada na instituição ativa.';
  END IF;

  RETURN jsonb_build_object(
    'classroom', jsonb_build_object(
      'id', v_classroom.id,
      'name', v_classroom.name,
      'code', v_classroom.code,
      'status', v_classroom.status
    ),
    'students', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'full_name', s.full_name,
          'enrollment', s.enrollment,
          'status', s.status
        )
        ORDER BY lower(s.full_name), s.id
      )
      FROM public.students s
      WHERE s.institution_id = v_institution
        AND s.classroom_id = v_classroom.id
    ), '[]'::jsonb),
    'teachers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', p.user_id,
          'name', COALESCE(p.display_name, 'Professor')
        )
        ORDER BY lower(COALESCE(p.display_name, 'Professor')), p.user_id
      )
      FROM public.classroom_teachers ct
      JOIN public.profiles p ON p.user_id = ct.user_id
      WHERE ct.classroom_id = v_classroom.id
        AND ct.institution_id = v_institution
    ), '[]'::jsonb),
    'subjects', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', su.id,
          'name', su.name,
          'code', su.code,
          'teacher_id', cs.teacher_id,
          'teacher_name', COALESCE(p.display_name, 'Professor não identificado')
        )
        ORDER BY lower(su.name), lower(COALESCE(p.display_name, ''))
      )
      FROM public.classroom_subjects cs
      JOIN public.subjects su ON su.id = cs.subject_id
      LEFT JOIN public.profiles p ON p.user_id = cs.teacher_id
      WHERE cs.classroom_id = v_classroom.id
        AND cs.institution_id = v_institution
        AND su.institution_id = v_institution
    ), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'students', (SELECT count(*) FROM public.students s WHERE s.institution_id=v_institution AND s.classroom_id=v_classroom.id),
      'teachers', (SELECT count(*) FROM public.classroom_teachers ct WHERE ct.institution_id=v_institution AND ct.classroom_id=v_classroom.id),
      'subject_links', (SELECT count(*) FROM public.classroom_subjects cs WHERE cs.institution_id=v_institution AND cs.classroom_id=v_classroom.id),
      'grades', (SELECT count(*) FROM public.grades g WHERE g.institution_id=v_institution AND g.student_id IN (SELECT s.id FROM public.students s WHERE s.institution_id=v_institution AND s.classroom_id=v_classroom.id)),
      'assessments', (SELECT count(*) FROM public.assessments a WHERE a.institution_id=v_institution AND a.classroom_id=v_classroom.id),
      'tasks', (SELECT count(*) FROM public.tasks t WHERE t.institution_id=v_institution AND t.classroom_id=v_classroom.id),
      'materials', (SELECT count(*) FROM public.academic_materials m WHERE m.institution_id=v_institution AND m.classroom_id=v_classroom.id),
      'attendance', (SELECT count(*) FROM public.attendance_records a WHERE a.institution_id=v_institution AND a.classroom_id=v_classroom.id)
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_get_classroom_hub(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_classroom_hub(uuid) TO authenticated;
