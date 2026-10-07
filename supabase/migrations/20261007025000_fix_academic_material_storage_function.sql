-- Fix the academic material storage access function delimiter and keep it
-- explicitly tenant-aware. The previous migration used a single-dollar
-- delimiter, which is not a valid PostgreSQL dollar-quote delimiter.
create or replace function public.student_can_read_academic_material(_path text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.has_role(auth.uid(),'student'::public.app_role)
    and exists (
      select 1
      from public.academic_materials m
      join public.students st
        on st.classroom_id=m.classroom_id
       and st.user_id=auth.uid()
      where m.file_path=_path
        and m.status='active'
        and st.institution_id=m.institution_id
    );
$$;

revoke all on function public.student_can_read_academic_material(text) from public, anon;
grant execute on function public.student_can_read_academic_material(text) to authenticated;
