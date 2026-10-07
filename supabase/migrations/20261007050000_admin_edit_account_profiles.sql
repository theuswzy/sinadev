-- Allow ADM to edit the profile of student and teacher accounts.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  _user_id uuid,
  _display_name text,
  _avatar_url text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  IF nullif(trim(coalesce(_display_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O nome completo é obrigatório.';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;

  UPDATE public.profiles
  SET display_name = trim(_display_name),
      avatar_url = CASE
        WHEN _avatar_url IS NULL THEN avatar_url
        ELSE nullif(trim(_avatar_url), '')
      END,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_profile(uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid,text,text) TO authenticated;
