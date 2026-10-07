-- Academic grade audit trail.
-- Every grade insert/update/delete is recorded server-side with tenant context.
-- The log is immutable from application roles; only the database trigger writes it.

CREATE TABLE IF NOT EXISTS public.grade_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  grade_id uuid,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id uuid,
  subject text,
  period integer NOT NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_score numeric,
  new_score numeric,
  old_absences integer,
  new_absences integer,
  old_row jsonb,
  new_row jsonb
);

CREATE INDEX IF NOT EXISTS idx_grade_change_audit_tenant_time
  ON public.grade_change_audit(institution_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_grade_change_audit_student
  ON public.grade_change_audit(institution_id, student_id, changed_at DESC);

ALTER TABLE public.grade_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read grade audit in institution" ON public.grade_change_audit;
CREATE POLICY "Admins can read grade audit in institution"
ON public.grade_change_audit
FOR SELECT TO authenticated
USING (
  institution_id = sina_private.current_institution('admin'::public.app_role)
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.audit_grade_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row public.grades;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_row := NEW;
    INSERT INTO public.grade_change_audit(
      institution_id, grade_id, student_id, subject_id, subject, period, action,
      changed_by, old_score, new_score, old_absences, new_absences, old_row, new_row
    )
    VALUES(
      NEW.institution_id, NEW.id, NEW.student_id, NEW.subject_id, NEW.subject, NEW.period, 'insert',
      auth.uid(), NULL, NEW.score, NULL, NEW.absences, NULL, to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.grade_change_audit(
      institution_id, grade_id, student_id, subject_id, subject, period, action,
      changed_by, old_score, new_score, old_absences, new_absences, old_row, new_row
    )
    VALUES(
      NEW.institution_id, NEW.id, NEW.student_id, NEW.subject_id, NEW.subject, NEW.period, 'update',
      auth.uid(), OLD.score, NEW.score, OLD.absences, NEW.absences, to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.grade_change_audit(
      institution_id, grade_id, student_id, subject_id, subject, period, action,
      changed_by, old_score, new_score, old_absences, new_absences, old_row, new_row
    )
    VALUES(
      OLD.institution_id, OLD.id, OLD.student_id, OLD.subject_id, OLD.subject, OLD.period, 'delete',
      auth.uid(), OLD.score, NULL, OLD.absences, NULL, to_jsonb(OLD), NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_grade_change ON public.grades;
CREATE TRIGGER trg_audit_grade_change
AFTER INSERT OR UPDATE OR DELETE ON public.grades
FOR EACH ROW
EXECUTE FUNCTION public.audit_grade_change();

REVOKE ALL ON public.grade_change_audit FROM public;
GRANT SELECT ON public.grade_change_audit TO authenticated;
