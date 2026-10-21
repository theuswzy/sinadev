-- SINA: global administrators need a limited onboarding queue before and during
-- first-institution setup. This does not expose student, teacher, or academic data.
CREATE OR REPLACE FUNCTION public.admin_list_bootstrap_role_requests()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  requested_role text,
  status text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz,
  school_directory_id uuid,
  school_name text,
  school_network_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT sina_private.is_global_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  RETURN QUERY
  SELECT
    rr.id,
    rr.user_id,
    au.email::text,
    COALESCE(p.display_name, ''),
    rr.requested_role::text,
    rr.status,
    rr.review_note,
    rr.created_at,
    rr.reviewed_at,
    rr.school_directory_id,
    d.name,
    d.network_type
  FROM public.account_role_requests rr
  JOIN auth.users au ON au.id = rr.user_id
  LEFT JOIN public.profiles p ON p.user_id = rr.user_id
  JOIN public.school_directory d
    ON d.id = rr.school_directory_id
   AND d.status = 'active'
  WHERE rr.status = 'pending'
    AND rr.institution_id IS NULL
    AND (
      d.institution_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.institution_memberships m
        WHERE m.user_id = auth.uid()
          AND m.institution_id = d.institution_id
          AND m.role = 'admin'::public.app_role
          AND m.status = 'active'
      )
    )
  ORDER BY rr.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_bootstrap_role_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_bootstrap_role_requests() TO authenticated;
