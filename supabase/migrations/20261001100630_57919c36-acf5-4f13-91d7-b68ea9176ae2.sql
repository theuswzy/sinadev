CREATE SCHEMA IF NOT EXISTS sina_private;
REVOKE ALL ON SCHEMA sina_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA sina_private TO authenticated;

CREATE OR REPLACE FUNCTION sina_private.list_accounts()
RETURNS TABLE (user_id uuid, email text, display_name text, academic_role text, is_administrator boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, COALESCE(p.display_name, '')::text,
    CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'teacher'::public.app_role)
      THEN 'teacher' ELSE 'student' END::text,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin'::public.app_role)
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY COALESCE(NULLIF(p.display_name, ''), u.email), u.email;
END;
$$;
REVOKE ALL ON FUNCTION sina_private.list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sina_private.list_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION sina_private.set_academic_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;
  IF _role NOT IN ('student', 'teacher') OR _role IS NULL THEN
    RAISE EXCEPTION 'Função acadêmica inválida.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN RETURN false; END IF;
  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'A função acadêmica de um administrador não pode ser alterada nesta tela.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role IN ('student'::public.app_role, 'teacher'::public.app_role);
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role::public.app_role);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION sina_private.set_academic_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sina_private.set_academic_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (user_id uuid, email text, display_name text, academic_role text, is_administrator boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT * FROM sina_private.list_accounts() $$;

CREATE OR REPLACE FUNCTION public.admin_set_academic_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT sina_private.set_academic_role(_user_id, _role) $$;