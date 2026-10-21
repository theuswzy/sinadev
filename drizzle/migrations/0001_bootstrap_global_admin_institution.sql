CREATE OR REPLACE FUNCTION sina_private.is_global_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  select exists (select 1 from public.user_roles r where r.user_id=_user_id and r.role='admin'::public.app_role)
  and coalesce((select p.status from public.profiles p where p.user_id=_user_id limit 1),'active')='active';
$$;
REVOKE ALL ON FUNCTION sina_private.is_global_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sina_private.is_global_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sina_private.create_admin_institution(_name text, _slug text, _school_directory_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare uid uuid:=auth.uid(); v_id uuid; v_school public.school_directory;
begin
 if not (public.has_role(uid,'admin'::public.app_role) or sina_private.is_global_admin(uid)) then raise exception 'Acesso reservado a administradores.'; end if;
 if nullif(trim(_name),'') is null or nullif(trim(_slug),'') is null then raise exception 'Nome e identificador da instituição são obrigatórios.'; end if;
 if _school_directory_id is not null then
  select * into v_school from public.school_directory where id=_school_directory_id and status='active' for update;
  if v_school.id is null then raise exception 'Escola inválida ou indisponível.'; end if;
  if v_school.institution_id is not null then
   insert into public.institution_memberships(institution_id,user_id,role,status) values(v_school.institution_id,uid,'admin'::public.app_role,'active') on conflict(institution_id,user_id,role) do update set status='active',updated_at=now();
   insert into public.user_institution_context(user_id,institution_id) values(uid,v_school.institution_id) on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();
   return v_school.institution_id;
  end if;
 end if;
 insert into public.institutions(name,slug,status,school_directory_id) values(trim(_name),lower(trim(_slug)),'active',_school_directory_id) returning id into v_id;
 insert into public.institution_memberships(institution_id,user_id,role,status) values(v_id,uid,'admin'::public.app_role,'active') on conflict(institution_id,user_id,role) do update set status='active',updated_at=now();
 insert into public.user_institution_context(user_id,institution_id) values(uid,v_id) on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();
 if _school_directory_id is not null then update public.school_directory set institution_id=v_id,updated_at=now() where id=_school_directory_id; end if;
 return v_id;
end; $function$;