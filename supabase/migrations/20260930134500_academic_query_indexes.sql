-- Performance indexes for the most frequent academic queries.
-- Keep these additive and safe for existing data.
create index if not exists students_teacher_id_idx
  on public.students (teacher_id)
  where teacher_id is not null;

create index if not exists grades_student_period_idx
  on public.grades (student_id, period, subject);
