CREATE OR REPLACE FUNCTION public.teacher_create_assessment(_classroom_id uuid, _subject_id uuid, _term_id uuid, _title text, _type text, _weight numeric, _max_score numeric, _due_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  inst uuid;
  assessment_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao professor';
  END IF;
  inst := sina_private.current_institution('teacher'::public.app_role);
  IF _weight IS NULL OR _weight <= 0 THEN RAISE EXCEPTION 'O peso deve ser maior que zero'; END IF;
  IF _max_score IS NULL OR _max_score <= 0 THEN RAISE EXCEPTION 'A nota máxima deve ser maior que zero'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classroom_teachers ct JOIN public.classrooms c ON c.id=ct.classroom_id
    WHERE ct.classroom_id=_classroom_id AND ct.user_id=auth.uid() AND c.institution_id=inst AND c.status='active'
  ) THEN RAISE EXCEPTION 'Você não está vinculado a esta turma'; END IF;
  IF _subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classroom_subjects cs JOIN public.subjects su ON su.id=cs.subject_id
    WHERE cs.classroom_id=_classroom_id AND cs.subject_id=_subject_id AND cs.teacher_id=auth.uid()
      AND cs.institution_id=inst AND su.institution_id=inst AND su.status='active'
  ) THEN RAISE EXCEPTION 'Disciplina não está vinculada a esta turma para você'; END IF;
  IF _term_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.academic_terms t WHERE t.id=_term_id AND t.institution_id=inst
  ) THEN RAISE EXCEPTION 'Período acadêmico inválido'; END IF;
  IF nullif(trim(_title),'') IS NULL THEN RAISE EXCEPTION 'Informe o título da avaliação'; END IF;
  INSERT INTO public.assessments(institution_id,classroom_id,subject_id,term_id,teacher_id,title,assessment_type,weight,max_score,due_at)
  VALUES(inst,_classroom_id,_subject_id,_term_id,auth.uid(),trim(_title),coalesce(nullif(trim(_type),''),'prova'),_weight,_max_score,_due_at)
  RETURNING id INTO assessment_id;
  RETURN assessment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.teacher_update_assessment(_id uuid, _classroom_id uuid, _subject_id uuid, _term_id uuid, _title text, _type text, _weight numeric, _max_score numeric, _due_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE inst uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'teacher'::public.app_role) THEN RAISE EXCEPTION 'Acesso restrito ao professor'; END IF;
  inst := sina_private.current_institution('teacher'::public.app_role);
  IF nullif(trim(_title),'') IS NULL THEN RAISE EXCEPTION 'Informe o título da avaliação'; END IF;
  IF _weight IS NULL OR _weight <= 0 THEN RAISE EXCEPTION 'O peso deve ser maior que zero'; END IF;
  IF _max_score IS NULL OR _max_score <= 0 THEN RAISE EXCEPTION 'A nota máxima deve ser maior que zero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessments a WHERE a.id=_id AND a.teacher_id=auth.uid() AND a.institution_id=inst) THEN
    RAISE EXCEPTION 'Avaliação não encontrada ou sem permissão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classroom_teachers ct JOIN public.classrooms c ON c.id=ct.classroom_id
    WHERE ct.classroom_id=_classroom_id AND ct.user_id=auth.uid() AND c.institution_id=inst AND c.status='active') THEN
    RAISE EXCEPTION 'Você não está vinculado a esta turma';
  END IF;
  IF _subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.classroom_subjects cs JOIN public.subjects su ON su.id=cs.subject_id
    WHERE cs.classroom_id=_classroom_id AND cs.subject_id=_subject_id AND cs.teacher_id=auth.uid()
      AND cs.institution_id=inst AND su.institution_id=inst AND su.status='active') THEN
    RAISE EXCEPTION 'Disciplina não está vinculada a esta turma para você';
  END IF;
  IF _term_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.academic_terms t WHERE t.id=_term_id AND t.institution_id=inst) THEN
    RAISE EXCEPTION 'Período acadêmico inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_scores sc WHERE sc.assessment_id=_id)
     AND EXISTS (SELECT 1 FROM public.assessments a WHERE a.id=_id AND a.classroom_id IS DISTINCT FROM _classroom_id) THEN
    RAISE EXCEPTION 'Não é possível trocar a turma de uma avaliação que já possui notas lançadas.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_scores sc WHERE sc.assessment_id=_id AND sc.score IS NOT NULL AND sc.score > _max_score) THEN
    RAISE EXCEPTION 'A nova nota máxima não pode ser menor que uma nota já lançada.';
  END IF;
  UPDATE public.assessments SET classroom_id=_classroom_id,subject_id=_subject_id,term_id=_term_id,title=trim(_title),
    assessment_type=coalesce(nullif(trim(_type),''),'prova'),weight=_weight,max_score=_max_score,due_at=_due_at,updated_at=now()
  WHERE id=_id AND teacher_id=auth.uid() AND institution_id=inst;
  RETURN true;
END;
$function$;