-- SINA: final tenant/role hardening for task submission flow and grade audit quality.
-- Keep all authorization server-side even when RPCs are called directly.

CREATE OR REPLACE FUNCTION public.student_list_task_submissions()
RETURNS TABLE(
  id uuid,
  task_id uuid,
  content text,
  attachment_path text,
  attachment_name text,
  status text,
  submitted_at timestamptz,
  score numeric,
  feedback text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT ts.id, ts.task_id, ts.content, ts.attachment_path, ts.attachment_name,
         ts.status, ts.submitted_at, ts.score, ts.feedback
  FROM public.task_submissions ts
  JOIN public.students s
    ON s.id = ts.student_id
   AND s.user_id = auth.uid()
   AND s.institution_id = sina_private.current_institution('student'::public.app_role)
  JOIN public.tasks t
    ON t.id = ts.task_id
   AND t.institution_id = s.institution_id
   AND t.classroom_id = s.classroom_id
  WHERE public.has_role(auth.uid(), 'student'::public.app_role)
  ORDER BY ts.submitted_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_list_task_submissions(_task_id uuid)
RETURNS TABLE(
  id uuid,
  task_id uuid,
  student_id uuid,
  student_name text,
  enrollment text,
  content text,
  status text,
  submitted_at timestamptz,
  score numeric,
  feedback text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT ts.id, ts.task_id, ts.student_id, s.full_name, s.enrollment,
         ts.content, ts.status, ts.submitted_at, ts.score, ts.feedback
  FROM public.task_submissions ts
  JOIN public.students s ON s.id = ts.student_id
  JOIN public.tasks t ON t.id = ts.task_id
  WHERE t.id = _task_id
    AND t.teacher_id = auth.uid()
    AND t.institution_id = sina_private.current_institution('teacher'::public.app_role)
    AND s.institution_id = t.institution_id
    AND s.classroom_id = t.classroom_id
    AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  ORDER BY s.full_name;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_grade_submission(
  _submission_id uuid,
  _score numeric,
  _feedback text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_inst uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores.';
  END IF;

  v_inst := sina_private.current_institution('teacher'::public.app_role);
  IF v_inst IS NULL THEN
    RAISE EXCEPTION 'Professor sem instituição ativa.';
  END IF;

  IF _score IS NULL OR _score < 0 OR _score > 10 THEN
    RAISE EXCEPTION 'A nota da atividade deve estar entre 0 e 10.';
  END IF;

  IF length(coalesce(_feedback, '')) > 5000 THEN
    RAISE EXCEPTION 'O feedback pode ter no máximo 5.000 caracteres.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.task_submissions ts
    JOIN public.tasks t ON t.id = ts.task_id
    JOIN public.students s ON s.id = ts.student_id
    WHERE ts.id = _submission_id
      AND t.teacher_id = auth.uid()
      AND t.institution_id = v_inst
      AND s.institution_id = v_inst
      AND s.classroom_id = t.classroom_id
  ) THEN
    RAISE EXCEPTION 'Entrega não pertence às suas turmas.';
  END IF;

  UPDATE public.task_submissions
  SET score = _score,
      feedback = nullif(trim(coalesce(_feedback, '')),
      ''),
      status = 'graded',
      graded_at = now(),
      updated_at = now()
  WHERE id = _submission_id;

  RETURN FOUND;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.student_list_task_submissions() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.student_list_task_submissions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_list_task_submissions(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_list_task_submissions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.teacher_grade_submission(uuid,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_grade_submission(uuid,numeric,text) TO authenticated;

-- Avoid audit noise from updates that do not change academic grade data.
CREATE OR REPLACE FUNCTION public.audit_grade_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.grade_change_audit(
      institution_id, grade_id, student_id, subject_id, subject, period, action,
      changed_by, old_score, new_score, old_absences, new_absences, old_row, new_row
    )
    VALUES(
      NEW.institution_id, NEW.id, NEW.student_id, NEW.subject_id, NEW.subject, NEW.period,
      'insert', auth.uid(), NULL, NEW.score, NULL, NEW.absences, NULL, to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.score IS NOT DISTINCT FROM NEW.score
      AND OLD.absences IS NOT DISTINCT FROM NEW.absences
      AND OLD.student_id IS NOT DISTINCT FROM NEW.student_id
      AND OLD.subject_id IS NOT DISTINCT FROM NEW.subject_id
      AND OLD.subject IS NOT DISTINCT FROM NEW.subject
      AND OLD.period IS NOT DISTINCT FROM NEW.period
      AND OLD.institution_id IS NOT DISTINCT FROM NEW.institution_id
      AND OLD.teacher_id IS NOT DISTINCT FROM NEW.teacher_id
    THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.grade_change_audit(
      institution_id, grade_id, student_id, subject_id, subject, period, action,
      changed_by, old_score, new_score, old_absences, new_absences, old_row, new_row
    )
    VALUES(
      NEW.institution_id, NEW.id, NEW.student_id, NEW.subject_id, NEW.subject, NEW.period,
      'update', auth.uid(), OLD.score, NEW.score, OLD.absences, NEW.absences,
      to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.grade_change_audit(
      institution_id, grade_id, student_id, subject_id, subject, period, action,
      changed_by, old_score, new_score, old_absences, new_absences, old_row, new_row
    )
    VALUES(
      OLD.institution_id, OLD.id, OLD.student_id, OLD.subject_id, OLD.subject, OLD.period,
      'delete', auth.uid(), OLD.score, NULL, OLD.absences, NULL, to_jsonb(OLD), NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;
