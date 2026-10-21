DROP POLICY IF EXISTS "Assessments visible to institution members" ON public.assessments;
CREATE POLICY "Assessments visible to assigned users" ON public.assessments
FOR SELECT TO authenticated
USING (
  (
    teacher_id = (SELECT auth.uid())
    AND public.has_role((SELECT auth.uid()), 'teacher'::public.app_role)
    AND institution_id = sina_private.current_institution('teacher'::public.app_role)
  )
  OR
  (
    status <> 'draft'
    AND institution_id = sina_private.current_institution('student'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = (SELECT auth.uid())
        AND s.institution_id = assessments.institution_id
        AND s.classroom_id = assessments.classroom_id
    )
  )
  OR
  (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    AND institution_id = sina_private.current_institution('admin'::public.app_role)
  )
);