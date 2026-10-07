-- Include teacher profile photos in the ADM teacher-management list.
DROP FUNCTION IF EXISTS public.admin_list_teacher_school_links();

CREATE FUNCTION public.admin_list_teacher_school_links()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  avatar_url text,
  institution_id uuid,
  institution_name text,
  school_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  select
    u.id,
    coalesce(nullif(p.display_name,''), split_part(coalesce(u.email,''),'@',1)),
    coalesce(u.email,''),
    p.avatar_url,
    coalesce(ctx.institution_id, first_membership.institution_id),
    coalesce(ctx.institution_name, first_membership.institution_name),
    coalesce(all_memberships.school_count,0)::bigint
  from auth.users u
  left join public.profiles p on p.user_id=u.id
  left join lateral (
    select m.institution_id, i.name as institution_name
    from public.institution_memberships m
    join public.institutions i on i.id=m.institution_id and i.status='active'
    where m.user_id=u.id and m.role='teacher'::public.app_role and m.status='active'
    order by m.updated_at desc, i.name
    limit 1
  ) first_membership on true
  left join lateral (
    select c.institution_id, i.name as institution_name
    from public.user_institution_context c
    join public.institution_memberships m
      on m.user_id=c.user_id and m.institution_id=c.institution_id
     and m.role='teacher'::public.app_role and m.status='active'
    join public.institutions i on i.id=c.institution_id and i.status='active'
    where c.user_id=u.id
    limit 1
  ) ctx on true
  left join lateral (
    select count(*) as school_count
    from public.institution_memberships m
    join public.institutions i on i.id=m.institution_id and i.status='active'
    where m.user_id=u.id and m.role='teacher'::public.app_role and m.status='active'
  ) all_memberships on true
  where public.has_role(auth.uid(),'admin'::public.app_role)
    and exists (
      select 1
      from public.institution_memberships tm
      where tm.user_id=u.id
        and tm.role='teacher'::public.app_role
        and tm.status='active'
    )
  order by lower(coalesce(nullif(p.display_name,''),coalesce(u.email,'')));
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_teacher_school_links() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_teacher_school_links() FROM public;
