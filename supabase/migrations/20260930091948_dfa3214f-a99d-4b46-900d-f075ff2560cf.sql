CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_teachers()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.email::text, COALESCE(p.display_name, ''), u.created_at
  FROM auth.users u
  JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'teacher'
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY COALESCE(p.display_name, ''), u.email
$$;
REVOKE ALL ON FUNCTION public.admin_list_teachers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_teachers() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_teacher_access(_email text, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;

  SELECT id INTO target_user
  FROM auth.users
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF target_user IS NULL THEN
    RETURN false;
  END IF;

  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user, 'teacher')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = target_user AND role = 'teacher';
  END IF;

  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION public.admin_set_teacher_access(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_teacher_access(text, boolean) TO authenticated;