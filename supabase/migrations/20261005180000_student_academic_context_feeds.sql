-- Student academic context feeds: keep each task, assessment, material and announcement
-- explicitly associated with its classroom, subject (when available) and teacher.
-- This prevents the student portal from collapsing multiple teachers into one generic feed.

CREATE OR REPLACE FUNCTION public.student_list_tasks_detailed()
RETURNS TABLE(
  id uuid,
  classroom_id uuid,
  classroom_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text,
  title text,
  description text,
  due_at timestamp with time zone,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  created_at timestamp with time zone,
  completed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    t.id,
    t.classroom_id,
    coalesce(c.name, t.classroom),
    t.subject_id,
    coalesce(su.name, nullif(trim(t.subject), '')),
    t.teacher_id,
    coalesce(p.display_name, 'Professor não identificado'),
    t.title,
    t.description,
    t.due_at,
    t.attachment_path,
    t.attachment_name,
    t.attachment_size,
    t.attachment_type,
    t.created_at,
    coalesce(tc.completed, false)
  from public.tasks t
  join public.students st
    on st.user_id=auth.uid()
   and st.institution_id=t.institution_id
   and st.classroom_id=t.classroom_id
  left join public.classrooms c on c.id=t.classroom_id
  left join public.subjects su on su.id=t.subject_id
  left join public.profiles p on p.user_id=t.teacher_id
  left join public.task_completions tc
    on tc.task_id=t.id and tc.student_id=st.id
  where t.institution_id=sina_private.current_institution('student'::public.app_role)
  order by coalesce(t.due_at,t.created_at) asc;
$function$;

CREATE OR REPLACE FUNCTION public.student_list_assessments_detailed()
RETURNS TABLE(
  id uuid,
  classroom_id uuid,
  classroom_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text,
  term_name text,
  title text,
  assessment_type text,
  weight numeric,
  max_score numeric,
  due_at timestamp with time zone,
  status text,
  score numeric,
  feedback text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    a.id,
    a.classroom_id,
    c.name,
    a.subject_id,
    coalesce(su.name, ''),
    a.teacher_id,
    coalesce(p.display_name, 'Professor não identificado'),
    coalesce(t.name, ''),
    a.title,
    a.assessment_type,
    a.weight,
    a.max_score,
    a.due_at,
    a.status,
    sc.score,
    sc.feedback
  from public.assessments a
  join public.students st
    on st.user_id=auth.uid()
   and st.institution_id=a.institution_id
   and st.classroom_id=a.classroom_id
  join public.classrooms c on c.id=a.classroom_id
  left join public.subjects su on su.id=a.subject_id
  left join public.profiles p on p.user_id=a.teacher_id
  left join public.academic_terms t on t.id=a.term_id
  left join public.assessment_scores sc
    on sc.assessment_id=a.id
   and sc.student_id=st.id
  where a.status <> 'draft'
    and a.institution_id=sina_private.current_institution('student'::public.app_role)
  order by coalesce(a.due_at,a.created_at) desc;
$function$;

CREATE OR REPLACE FUNCTION public.student_list_academic_materials_detailed()
RETURNS TABLE(
  id uuid,
  classroom_id uuid,
  classroom_name text,
  subject_id uuid,
  subject_name text,
  teacher_id uuid,
  teacher_name text,
  term_id uuid,
  term_name text,
  title text,
  description text,
  file_path text,
  file_name text,
  file_size bigint,
  file_type text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    m.id,
    m.classroom_id,
    c.name,
    m.subject_id,
    s.name,
    m.created_by,
    coalesce(p.display_name, 'Responsável acadêmico'),
    m.term_id,
    t.name,
    m.title,
    m.description,
    m.file_path,
    m.file_name,
    m.file_size,
    m.file_type,
    m.created_at
  from public.academic_materials m
  join public.students st
    on st.classroom_id=m.classroom_id
   and st.user_id=auth.uid()
   and st.institution_id=m.institution_id
  join public.classrooms c on c.id=m.classroom_id
  left join public.subjects s on s.id=m.subject_id
  left join public.profiles p on p.user_id=m.created_by
  left join public.academic_terms t on t.id=m.term_id
  where m.status='active'
    and m.institution_id=sina_private.current_institution('student'::public.app_role)
  order by m.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.student_list_announcements_detailed()
RETURNS TABLE(
  id uuid,
  teacher_id uuid,
  teacher_name text,
  classroom_id uuid,
  classroom_name text,
  title text,
  content text,
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    a.id,
    a.teacher_id,
    coalesce(p.display_name, 'Professor não identificado'),
    a.classroom_id,
    coalesce(c.name, a.classroom),
    a.title,
    a.content,
    a.attachment_path,
    a.attachment_name,
    a.attachment_size,
    a.attachment_type,
    a.created_at,
    a.updated_at
  from public.announcements a
  join public.students st
    on st.user_id=auth.uid()
   and st.institution_id=a.institution_id
   and st.classroom_id=a.classroom_id
  left join public.classrooms c on c.id=a.classroom_id
  left join public.profiles p on p.user_id=a.teacher_id
  where a.institution_id=sina_private.current_institution('student'::public.app_role)
  order by a.created_at desc
  limit 100;
$function$;

grant execute on function public.student_list_tasks_detailed() to authenticated;
grant execute on function public.student_list_assessments_detailed() to authenticated;
grant execute on function public.student_list_academic_materials_detailed() to authenticated;
grant execute on function public.student_list_announcements_detailed() to authenticated;
