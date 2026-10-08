-- SINA: repair administrative controls introduced in the academic panel.
-- Adds tenant-scoped administrator promotion and re-declares the period/audit
-- RPCs so a schema drift cannot leave the admin panel with broken controls.

CREATE OR REPLACE FUNCTION public.admin_set_administrator(
  _user_id uuid,
  _enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_admin_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  IF _user_id = auth.uid() AND NOT _enabled THEN
    RAISE EXCEPTION 'O administrador conectado não pode remover a própria função administrativa.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Nenhuma instituição administrativa ativa encontrada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.institution_memberships
    WHERE user_id = _user_id
      AND institution_id = v_institution
  ) THEN
    IF _enabled THEN
      INSERT INTO public.institution_memberships(institution_id, user_id, role, status)
      VALUES (v_institution, _user_id, 'admin'::public.app_role, 'active')
      ON CONFLICT (institution_id, user_id, role)
      DO UPDATE SET status = 'active', updated_at = now();
    ELSE
      RAISE EXCEPTION 'O usuário não pertence à instituição administrativa ativa.';
    END IF;
  END IF;

  IF _enabled THEN
    INSERT INTO public.institution_memberships(institution_id, user_id, role, status)
    VALUES (v_institution, _user_id, 'admin'::public.app_role, 'active')
    ON CONFLICT (institution_id, user_id, role)
    DO UPDATE SET status = 'active', updated_at = now();

    INSERT INTO public.user_roles(user_id, role)
    VALUES (_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
    SET status = 'active', updated_at = now()
    WHERE user_id = _user_id;

    RETURN true;
  END IF;

  SELECT count(*)
  INTO v_admin_count
  FROM public.institution_memberships
  WHERE institution_id = v_institution
    AND role = 'admin'::public.app_role
    AND status = 'active';

  IF v_admin_count <= 1 THEN
    RAISE EXCEPTION 'A instituição precisa manter pelo menos um administrador.';
  END IF;

  UPDATE public.institution_memberships
  SET status = 'suspended', updated_at = now()
  WHERE institution_id = v_institution
    AND user_id = _user_id
    AND role = 'admin'::public.app_role;

  IF NOT EXISTS (
    SELECT 1
    FROM public.institution_memberships
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role
      AND status = 'active'
  ) THEN
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role;
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_administrator(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_administrator(uuid, boolean) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_list_academic_period_locks()
RETURNS TABLE(period integer, is_closed boolean, closed_at timestamptz, closed_by uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  RETURN QUERY
  SELECT p.period, (l.id IS NOT NULL), l.closed_at, l.closed_by
  FROM generate_series(1, 4) AS p(period)
  LEFT JOIN public.academic_period_locks l
    ON l.institution_id = v_institution
   AND l.period = p.period
  ORDER BY p.period;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_academic_period_locks() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_academic_period_locks() TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_set_academic_period_lock(
  _period integer,
  _closed boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Administrador sem instituição ativa.';
  END IF;

  IF _period NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  IF _closed THEN
    INSERT INTO public.academic_period_locks(
      institution_id, period, closed_at, closed_by, updated_at
    )
    VALUES(v_institution, _period, now(), auth.uid(), now())
    ON CONFLICT (institution_id, period)
    DO UPDATE SET closed_at = now(), closed_by = auth.uid(), updated_at = now();

    INSERT INTO public.academic_period_lock_audit(
      institution_id, period, action, changed_by
    )
    VALUES(v_institution, _period, 'closed', auth.uid());

    RETURN true;
  END IF;

  DELETE FROM public.academic_period_locks
  WHERE institution_id = v_institution
    AND period = _period;

  INSERT INTO public.academic_period_lock_audit(
    institution_id, period, action, changed_by
  )
  SELECT v_institution, _period, 'reopened', auth.uid()
  WHERE EXISTS (
    SELECT 1
    FROM public.academic_period_lock_audit
    WHERE institution_id = v_institution
      AND period = _period
      AND action = 'closed'
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_academic_period_lock(integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_academic_period_lock(integer, boolean) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_list_grade_change_audit(_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  grade_id uuid,
  student_id uuid,
  student_name text,
  subject_id uuid,
  subject text,
  period integer,
  action text,
  changed_by uuid,
  changed_at timestamptz,
  old_score numeric,
  new_score numeric,
  old_absences integer,
  new_absences integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Instituição administrativa não encontrada.';
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.grade_id, a.student_id, s.full_name,
    a.subject_id, a.subject, a.period, a.action, a.changed_by,
    a.changed_at, a.old_score, a.new_score, a.old_absences, a.new_absences
  FROM public.grade_change_audit a
  LEFT JOIN public.students s
    ON s.id = a.student_id
   AND s.institution_id = v_institution
  WHERE a.institution_id = v_institution
  ORDER BY a.changed_at DESC
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_grade_change_audit(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_grade_change_audit(integer) TO authenticated;
