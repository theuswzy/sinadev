-- Restrict teacher access to tasks/submissions to currently assigned classrooms.
-- Keep student-owned reads and admin reads scoped to the current institution.
drop policy if exists "Students and owners can read tasks" on public.tasks;
create policy "Students and assigned teachers can read tasks"
on public.tasks for select to authenticated
using (
  exists (
    select 1 from public.classroom_teachers ct
    join public.classrooms c on c.id=ct.classroom_id
    where ct.user_id=auth.uid()
      and ct.classroom_id=tasks.classroom_id
      and c.institution_id=tasks.institution_id
      and c.status='active'
      and tasks.teacher_id=auth.uid()
      and tasks.institution_id=sina_private.current_institution('teacher'::public.app_role)
  )
  or exists (
    select 1 from public.students s
    where s.user_id=auth.uid()
      and s.institution_id=tasks.institution_id
      and (
        s.classroom_id=tasks.classroom_id
        or (tasks.classroom_id is null and s.classroom=tasks.classroom)
      )
  )
  or (
    public.has_role(auth.uid(),'admin'::public.app_role)
    and tasks.institution_id=sina_private.current_institution('admin'::public.app_role)
  )
);

drop policy if exists "Teachers can delete own tasks" on public.tasks;
create policy "Teachers can delete tasks in assigned classrooms"
on public.tasks for delete to authenticated
using (
  tasks.teacher_id=auth.uid()
  and public.has_role(auth.uid(),'teacher'::public.app_role)
  and tasks.institution_id=sina_private.current_institution('teacher'::public.app_role)
  and exists (
    select 1 from public.classroom_teachers ct
    join public.classrooms c on c.id=ct.classroom_id
    where ct.user_id=auth.uid()
      and ct.classroom_id=tasks.classroom_id
      and c.institution_id=tasks.institution_id
      and c.status='active'
  )
);

drop policy if exists "Task submissions visible to owners" on public.task_submissions;
create policy "Task submissions visible to students assigned teachers and admins"
on public.task_submissions for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id=task_submissions.student_id and s.user_id=auth.uid()
  )
  or exists (
    select 1 from public.tasks t
    join public.classroom_teachers ct on ct.classroom_id=t.classroom_id and ct.user_id=auth.uid()
    join public.classrooms c on c.id=t.classroom_id and c.institution_id=t.institution_id and c.status='active'
    where t.id=task_submissions.task_id
      and t.teacher_id=auth.uid()
      and t.institution_id=sina_private.current_institution('teacher'::public.app_role)
  )
  or (
    public.has_role(auth.uid(),'admin'::public.app_role)
    and exists (
      select 1 from public.tasks t
      where t.id=task_submissions.task_id
        and t.institution_id=sina_private.current_institution('admin'::public.app_role)
    )
  )
);

-- Keep student records visible to the student and to teachers only for their
-- current institution/class assignment (or unassigned records they created).
drop policy if exists "teacher students read" on public.students;
create policy "teachers read assigned student records"
on public.students for select to authenticated
using (
  user_id=auth.uid()
  or (
    public.has_role(auth.uid(),'teacher'::public.app_role)
    and institution_id=sina_private.current_institution('teacher'::public.app_role)
    and (
      exists (
        select 1 from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.user_id=auth.uid()
          and ct.classroom_id=students.classroom_id
          and c.institution_id=students.institution_id
          and c.status='active'
      )
      or (classroom_id is null and teacher_id=auth.uid())
    )
  )
);

drop policy if exists "teacher students edit" on public.students;
create policy "teachers edit assigned student records"
on public.students for update to authenticated
using (
  public.has_role(auth.uid(),'teacher'::public.app_role)
  and institution_id=sina_private.current_institution('teacher'::public.app_role)
  and (
    exists (
      select 1 from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where ct.user_id=auth.uid()
        and ct.classroom_id=students.classroom_id
        and c.institution_id=students.institution_id
        and c.status='active'
    )
    or (classroom_id is null and teacher_id=auth.uid())
  )
)
with check (
  public.has_role(auth.uid(),'teacher'::public.app_role)
  and institution_id=sina_private.current_institution('teacher'::public.app_role)
  and (
    exists (
      select 1 from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where ct.user_id=auth.uid()
        and ct.classroom_id=students.classroom_id
        and c.institution_id=students.institution_id
        and c.status='active'
    )
    or (classroom_id is null and teacher_id=auth.uid())
  )
);

drop policy if exists "teacher students delete" on public.students;
create policy "teachers delete assigned student records"
on public.students for delete to authenticated
using (
  public.has_role(auth.uid(),'teacher'::public.app_role)
  and institution_id=sina_private.current_institution('teacher'::public.app_role)
  and teacher_id=auth.uid()
  and classroom_id is null
);
