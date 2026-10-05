-- Keep grade records tied to the teacher who launched them.
-- Legacy rows are backfilled only when the student's class has exactly one
-- active teacher assignment for the subject, avoiding false attribution.

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS teacher_id uuid;

CREATE INDEX IF NOT EXISTS grades_teacher_id_idx
  ON public.grades (teacher_id);

WITH candidates AS (
  SELECT
    g.id,
    min(cs.subject_id::text)::uuid AS subject_id,
    min(cs.teacher_id::text)::uuid AS teacher_id
  FROM public.grades g
  JOIN public.students st
    ON st.id=g.student_id
   AND st.institution_id=g.institution_id
  JOIN public.subjects su
    ON su.institution_id=g.institution_id
   AND (
     (g.subject_id IS NOT NULL AND su.id=g.subject_id)
     OR (g.subject_id IS NULL AND lower(su.name)=lower(trim(g.subject)))
   )
  JOIN public.classroom_subjects cs
    ON cs.institution_id=g.institution_id
   AND cs.classroom_id=st.classroom_id
   AND cs.subject_id=su.id
  GROUP BY g.id
  HAVING count(cs.id)=1
)
UPDATE public.grades g
SET subject_id=coalesce(g.subject_id,c.subject_id),
    teacher_id=coalesce(g.teacher_id,c.teacher_id)
FROM candidates c
WHERE c.id=g.id
  AND (g.subject_id IS NULL OR g.teacher_id IS NULL);

CREATE OR REPLACE FUNCTION public.teacher_upsert_grade(
  _student_id uuid,
  _subject text,
  _period integer,
  _score numeric,
  _absences integer
)
RETURNS public.grades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result_row public.grades;
  inst uuid;
  classroom_id uuid;
  subject_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a professores autorizados.';
  END IF;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  IF nullif(trim(_subject),'') IS NULL THEN
    RAISE EXCEPTION 'Informe a disciplina.';
  END IF;

  IF _period < 1 OR _period > 4 OR _score < 0 OR _score > 10 OR _absences < 0 THEN
    RAISE EXCEPTION 'Dados da nota inválidos.';
  END IF;

  SELECT s.classroom_id INTO classroom_id
  FROM public.students s
  WHERE s.id=_student_id
    AND s.institution_id=inst
    AND EXISTS(
      SELECT 1
      FROM public.classroom_teachers ct
      JOIN public.classrooms c ON c.id=ct.classroom_id
      WHERE ct.classroom_id=s.classroom_id
        AND ct.user_id=auth.uid()
        AND c.institution_id=inst
        AND c.status='active'
    );

  IF classroom_id IS NULL THEN
    RAISE EXCEPTION 'Aluno não pertence a uma turma vinculada a este professor.';
  END IF;

  SELECT su.id INTO subject_id
  FROM public.classroom_subjects cs
  JOIN public.subjects su ON su.id=cs.subject_id
  WHERE cs.classroom_id=classroom_id
    AND cs.institution_id=inst
    AND cs.teacher_id=auth.uid()
    AND su.institution_id=inst
    AND su.status='active'
    AND lower(su.name)=lower(trim(_subject))
  LIMIT 1;

  IF subject_id IS NULL THEN
    RAISE EXCEPTION 'A disciplina não está vinculada a esta turma para você.';
  END IF;

  INSERT INTO public.grades(
    student_id,subject,period,score,absences,institution_id,subject_id,teacher_id
  )
  VALUES(
    _student_id,trim(_subject),_period,_score,_absences,inst,subject_id,auth.uid()
  )
  ON CONFLICT(student_id,subject,period)
  DO UPDATE SET
    score=excluded.score,
    absences=excluded.absences,
    institution_id=excluded.institution_id,
    subject_id=excluded.subject_id,
    teacher_id=excluded.teacher_id,
    updated_at=now()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$function$;
