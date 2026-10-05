-- Safer administration of classrooms.
-- Permanent deletion is intentionally restricted to classrooms with no
-- academic/enrollment history. Otherwise the administrator must archive it.

CREATE OR REPLACE FUNCTION public.admin_delete_classroom(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  inst uuid;
  students_count integer;
  teachers_count integer;
  subjects_count integer;
  tasks_count integer;
  assessments_count integer;
  attendance_count integer;
  materials_count integer;
  events_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  inst:=sina_private.current_institution('admin'::public.app_role);

  SELECT count(*) INTO students_count FROM public.students WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO teachers_count FROM public.classroom_teachers WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO subjects_count FROM public.classroom_subjects WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO tasks_count FROM public.tasks WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO assessments_count FROM public.assessments WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO attendance_count FROM public.attendance_records WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO materials_count FROM public.academic_materials WHERE classroom_id=_id AND institution_id=inst;
  SELECT count(*) INTO events_count FROM public.calendar_events WHERE classroom_id=_id AND institution_id=inst;

  IF students_count + teachers_count + subjects_count + tasks_count + assessments_count +
     attendance_count + materials_count + events_count > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir esta turma porque existem dados vinculados. Arquive a turma para preservar o histórico.';
  END IF;

  DELETE FROM public.classrooms
  WHERE id=_id
    AND institution_id=inst
    AND status='archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A turma precisa estar arquivada antes da exclusão definitiva.';
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_restore_classroom(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  UPDATE public.classrooms
  SET status='active', updated_at=now()
  WHERE id=_id
    AND institution_id=sina_private.current_institution('admin'::public.app_role)
    AND status='archived';

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_academic_setup()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  inst uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  inst:=sina_private.current_institution('admin'::public.app_role);

  RETURN jsonb_build_object(
    'classrooms',
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',c.id,
          'name',c.name,
          'code',c.code,
          'status',c.status,
          'student_count',(SELECT count(*) FROM public.students s WHERE s.classroom_id=c.id AND s.institution_id=inst),
          'teacher_count',(SELECT count(*) FROM public.classroom_teachers ct WHERE ct.classroom_id=c.id AND ct.institution_id=inst),
          'subject_count',(SELECT count(*) FROM public.classroom_subjects cs WHERE cs.classroom_id=c.id AND cs.institution_id=inst),
          'task_count',(SELECT count(*) FROM public.tasks t WHERE t.classroom_id=c.id AND t.institution_id=inst),
          'assessment_count',(SELECT count(*) FROM public.assessments a WHERE a.classroom_id=c.id AND a.institution_id=inst),
          'attendance_count',(SELECT count(*) FROM public.attendance_records ar WHERE ar.classroom_id=c.id AND ar.institution_id=inst)
        )
        ORDER BY c.status='active' DESC,c.name
      )
      FROM public.classrooms c
      WHERE c.institution_id=inst
    ),'[]'::jsonb),
    'subjects',coalesce((SELECT jsonb_agg(to_jsonb(su) ORDER BY su.name) FROM public.subjects su WHERE su.institution_id=inst),'[]'::jsonb),
    'terms',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.starts_at NULLS LAST,t.name) FROM public.academic_terms t WHERE t.institution_id=inst),'[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_classroom(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.admin_restore_classroom(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_classroom(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_classroom(uuid) TO authenticated;
