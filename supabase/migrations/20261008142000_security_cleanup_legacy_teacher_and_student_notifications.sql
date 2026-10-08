-- Security cleanup for legacy RPCs no longer used by the application.
-- Keep the functions available for historical compatibility, but do not expose
-- unsafe legacy write paths to authenticated clients.

revoke all on function public.teacher_link_student(uuid,text,text) from public;
revoke execute on function public.teacher_link_student(uuid,text,text) from authenticated;

revoke all on function public.teacher_update_attendance(uuid,numeric) from public;
revoke execute on function public.teacher_update_attendance(uuid,numeric) from authenticated;

-- Mark-all on the student notification center must respect the active institution,
-- matching student_list_notifications and the teacher notification center.
create or replace function public.student_mark_all_notifications_read()
returns integer
language sql
security definer
set search_path to ''
as $function$
with updated as (
  update public.notifications n
     set read_at=now()
   where n.user_id=auth.uid()
     and n.read_at is null
     and coalesce(
       (n.metadata->>'institution_id')::uuid,
       sina_private.current_institution('student'::public.app_role)
     ) = sina_private.current_institution('student'::public.app_role)
   returning n.id
)
select count(*)::integer from updated;
$function$;

revoke all on function public.student_mark_all_notifications_read() from public;
grant execute on function public.student_mark_all_notifications_read() to authenticated;
