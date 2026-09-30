-- Bootstrap the initial SINA administrator.
-- This migration is intentionally idempotent and only grants the admin role
-- to the existing account with this email.
DO $$
DECLARE
  target_user uuid;
BEGIN
  SELECT id
  INTO target_user
  FROM auth.users
  WHERE lower(email) = lower('matheuspaixao818@gmail.com')
  LIMIT 1;

  IF target_user IS NULL THEN
    RAISE EXCEPTION 'Conta matheuspaixao818@gmail.com não encontrada em auth.users';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END
$$;
