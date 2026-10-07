-- SINA: prevent an inconsistent subject from being published by a teacher.
-- Activities and assessments remain available to both responsible and additional
-- teachers, but every subject-specific write must match the teacher's classroom
-- subject assignment in the current institution.

CREATE OR REPLACE FUNCTION sina_private.assert_teacher_subject_assignment(
  _classroom_id uuid,
  _subject_id uuid,
  _teacher_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF NOT public.has_role(_teacher_id, 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores autorizados.';
  END IF;

  v_institution := sina_private.current_institution('teacher'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classroom_subjects cs
    JOIN public.classrooms c ON c.id = cs.classroom_id
    JOIN public.subjects s ON s.id = cs.subject_id
    WHERE cs.classroom_id = _classroom_id
      AND cs.subject_id = _subject_id
      AND cs.teacher_id = _teacher_id
      AND cs.institution_id = v_institution
      AND c.institution_id = v_institution
      AND c.status = 'active'
      AND s.institution_id = v_institution
      AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'A disciplina não está vinculada a esta turma para este professor.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION sina_private.assert_teacher_subject_assignment(uuid,uuid,uuid) FROM public,anon,authenticated;

-- Keep the existing public publishing APIs, but add an explicit subject
-- assignment assertion immediately before the write. This migration deliberately
-- does not alter ownership semantics: teachers can still edit only their own
-- publications.
CREATE OR REPLACE FUNCTION public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz,
  _attachment_path text DEFAULT NULL,
  _attachment_name text DEFAULT NULL,
  _attachment_size bigint DEFAULT NULL,
  _attachment_type text DEFAULT NULL
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  result_row public.tasks;
  v_inst uuid;
  v_classroom_id uuid;
  v_subject_id uuid;
  v_classroom_candidate uuid;
  v_subject_candidate uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN RAISE EXCEPTION 'Acesso restrito a professores.'; END IF;
  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN RAISE EXCEPTION 'Professor sem instituição ativa.'; END IF;
  v_classroom_candidate := CASE WHEN trim(_classroom) ~* '^[0-9a-f-]{36}$' THEN trim(_classroom)::uuid ELSE NULL END;
  SELECT c.id INTO v_classroom_id
  FROM public.classrooms c JOIN public.classroom_teachers ct ON ct.classroom_id=c.id AND ct.user_id=auth.uid()
  WHERE c.institution_id=v_inst AND c.status='active'
    AND (c.id=v_classroom_candidate OR lower(c.name)=lower(trim(_classroom)))
  ORDER BY CASE WHEN c.id=v_classroom_candidate THEN 0 ELSE 1 END LIMIT 1;
  IF v_classroom_id IS NULL THEN RAISE EXCEPTION 'A turma selecionada não pertence a você.'; END IF;

  v_subject_candidate := CASE WHEN trim(_subject) ~* '^[0-9a-f-]{36}$' THEN trim(_subject)::uuid ELSE NULL END;
  SELECT s.id INTO v_subject_id
  FROM public.subjects s
  WHERE s.institution_id=v_inst AND s.status='active'
    AND (s.id=v_subject_candidate OR lower(s.name)=lower(trim(_subject)))
  ORDER BY CASE WHEN s.id=v_subject_candidate THEN 0 ELSE 1 END LIMIT 1;
  IF v_subject_id IS NULL THEN RAISE EXCEPTION 'A disciplina não está disponível nesta instituição.'; END IF;

  PERFORM sina_private.assert_teacher_subject_assignment(v_classroom_id,v_subject_id);

  INSERT INTO public.tasks(
    teacher_id,classroom,subject,title,description,due_at,attachment_path,attachment_name,
    attachment_size,attachment_type,institution_id,classroom_id
  )
  VALUES(
    auth.uid(),
    (SELECT c.name FROM public.classrooms c WHERE c.id=v_classroom_id),
    (SELECT s.name FROM public.subjects s WHERE s.id=v_subject_id),
    trim(_title),coalesce(_description,''),_due_at,
    nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),
    v_inst,v_classroom_id
  )
  RETURNING * INTO result_row;

  PERFORM sina_private.create_classroom_notifications(
    auth.uid(),v_classroom_id,'task','Nova atividade: '||trim(_title),
    coalesce(nullif(trim(_description),''),'Uma nova atividade foi publicada.'),'/aluno/tarefas'
  );
  RETURN result_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) TO authenticated;
