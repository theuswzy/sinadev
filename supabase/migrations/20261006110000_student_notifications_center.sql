CREATE OR REPLACE FUNCTION public.student_mark_all_notifications_read()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH updated AS (
    UPDATE public.notifications
       SET read_at = now()
     WHERE user_id = auth.uid()
       AND read_at IS NULL
    RETURNING id
  )
  SELECT count(*)::integer FROM updated;
$function$;

REVOKE EXECUTE ON FUNCTION public.student_mark_all_notifications_read() FROM public;
GRANT EXECUTE ON FUNCTION public.student_mark_all_notifications_read() TO authenticated;
