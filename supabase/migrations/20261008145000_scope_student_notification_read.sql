-- Keep individual student notification reads scoped to the active institution.
create or replace function public.student_mark_notification_read(_id uuid)
returns boolean
language sql
security definer
set search_path to ''
as $function$
  update public.notifications n
     set read_at = coalesce(n.read_at, now())
   where n.id = _id
     and n.user_id = auth.uid()
     and coalesce(
       (n.metadata->>'institution_id')::uuid,
       sina_private.current_institution('student'::public.app_role)
     ) = sina_private.current_institution('student'::public.app_role)
  returning true;
$function$;

revoke all on function public.student_mark_notification_read(uuid) from public, anon;
grant execute on function public.student_mark_notification_read(uuid) to authenticated;
