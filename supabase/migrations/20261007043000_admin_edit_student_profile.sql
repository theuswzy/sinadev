-- Allow administrators to edit student profile data within their active institution.
CREATE OR REPLACE FUNCTION public.admin_update_student_profile(
  _student_id uuid,
  _full_name text,
  _enrollment text DEFAULT NULL,
  _avatar_url text DEFAULT NULL
)
RETURNS public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_institution uuid;
  v_student public.students;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.';
  END IF;

  v_institution := sina_private.current_institution('admin'::public.app_role);
  IF v_institution IS NULL THEN
    RAISE EXCEPTION 'Nenhuma instituição ativa encontrada.';
  END IF;

  IF nullif(trim(coalesce(_full_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O nome completo do aluno é obrigatório.';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = _student_id
    AND institution_id = v_institution;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado na instituição ativa.';
  END IF;

  UPDATE public.students
  SET
    full_name = trim(_full_name),
    enrollment = coalesce(nullif(trim(coalesce(_enrollment, '')), ''), v_student.enrollment),
    avatar_url = nullif(trim(coalesce(_avatar_url, '')), ''),
    updated_at = now()
  WHERE id = _student_id
  RETURNING * INTO v_student;

  IF v_student.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET display_name = v_student.full_name,
        updated_at = now()
    WHERE user_id = v_student.user_id;
  END IF;

  RETURN v_student;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_update_student_profile(uuid,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_student_profile(uuid,text,text,text) TO authenticated;

DROP POLICY IF EXISTS "Admins can upload student avatars" ON storage.objects;
CREATE POLICY "Admins can upload student avatars"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can update student avatars" ON storage.objects;
CREATE POLICY "Admins can update student avatars"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'avatars'
  AND public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete student avatars" ON storage.objects;
CREATE POLICY "Admins can delete student avatars"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND public.is_admin(auth.uid())
);

-- Include the profile photo in the paginated admin student list.
CREATE OR REPLACE FUNCTION public.admin_list_students_page(
  _search text DEFAULT '',
  _only_without_class boolean DEFAULT false,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  inst uuid;
  v_page integer := greatest(coalesce(_page,1),1);
  v_size integer := least(greatest(coalesce(_page_size,25),1),100);
  v_search text := lower(trim(coalesce(_search,'')));
  v_total bigint;
  v_items jsonb;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  inst := sina_private.current_institution('admin'::public.app_role);
  if inst is null then raise exception 'Nenhuma instituição ativa encontrada.'; end if;

  select count(*) into v_total
  from public.students s
  left join public.classrooms c on c.id=s.classroom_id and c.institution_id=s.institution_id
  where s.institution_id=inst
    and (v_search='' or lower(concat_ws(' ',s.full_name,s.enrollment,coalesce(c.name,''))) like '%'||v_search||'%')
    and (not coalesce(_only_without_class,false) or s.classroom_id is null);

  select coalesce(jsonb_agg(to_jsonb(x) order by lower(x.full_name)),'[]'::jsonb) into v_items
  from (
    select s.id,s.user_id,s.full_name,s.enrollment,s.avatar_url,s.classroom_id,c.name as classroom_name,
           case when c.id is null then 'sem_turma' else 'matriculado' end as status
    from public.students s
    left join public.classrooms c on c.id=s.classroom_id and c.institution_id=s.institution_id
    where s.institution_id=inst
      and (v_search='' or lower(concat_ws(' ',s.full_name,s.enrollment,coalesce(c.name,''))) like '%'||v_search||'%')
      and (not coalesce(_only_without_class,false) or s.classroom_id is null)
    order by lower(s.full_name)
    offset (v_page-1)*v_size limit v_size
  ) x;

  return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'page_size',v_size);
end;
$function$;
