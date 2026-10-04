-- Improve teacher agenda visibility.
-- Teachers see their own events plus scheduled events for classrooms they teach,
-- while preserving institution isolation.
create or replace function public.teacher_list_calendar(_from timestamptz, _to timestamptz)
returns table(
 id uuid, classroom_id uuid, classroom_name text, title text, description text,
 start_at timestamptz, end_at timestamptz, event_type text, status text
)
language sql
stable security definer
set search_path=''
as $$
  select e.id,e.classroom_id,c.name,e.title,e.description,e.start_at,e.end_at,e.event_type,e.status
  from public.calendar_events e
  left join public.classrooms c on c.id=e.classroom_id
  where e.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and e.status='scheduled'
    and (
      e.created_by=auth.uid()
      or exists (
        select 1 from public.classroom_teachers ct
        where ct.classroom_id=e.classroom_id
          and ct.user_id=auth.uid()
      )
    )
    and (_from is null or e.start_at >= _from)
    and (_to is null or e.start_at <= _to)
  order by e.start_at asc
  limit 200;
$$;

revoke execute on function public.teacher_list_calendar(timestamptz,timestamptz) from public,anon;
grant execute on function public.teacher_list_calendar(timestamptz,timestamptz) to authenticated;
