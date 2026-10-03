create or replace function sina_private.list_teacher_grades(_student_id uuid)
returns setof public.grades language sql stable security definer set search_path to '' as $$
select g.* from public.grades g join public.students s on s.id=g.student_id
where s.id=_student_id and s.teacher_id=auth.uid() and s.institution_id=sina_private.current_institution('teacher'::public.app_role) and g.institution_id=s.institution_id order by g.subject,g.period;
$$;
create or replace function sina_private.list_student_grades()
returns setof public.grades language sql stable security definer set search_path to '' as $$
select g.* from public.grades g join public.students s on s.id=g.student_id
where s.user_id=auth.uid() and g.institution_id=s.institution_id order by g.subject,g.period;
$$;
revoke all on function sina_private.list_teacher_grades(uuid) from public,anon;
revoke all on function sina_private.list_student_grades() from public,anon;
grant execute on function sina_private.list_teacher_grades(uuid) to authenticated;
grant execute on function sina_private.list_student_grades() to authenticated;
create or replace function public.teacher_list_grades(_student_id uuid)
returns setof public.grades language sql stable security invoker set search_path to '' as $$ select * from sina_private.list_teacher_grades(_student_id); $$;
create or replace function public.student_list_grades()
returns setof public.grades language sql stable security invoker set search_path to '' as $$ select * from sina_private.list_student_grades(); $$;
revoke all on function public.teacher_list_grades(uuid) from public,anon;
revoke all on function public.student_list_grades() from public,anon;
grant execute on function public.teacher_list_grades(uuid) to authenticated;
grant execute on function public.student_list_grades() to authenticated;

create or replace function sina_private.create_admin_institution(_name text,_slug text,_school_directory_id uuid default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare uid uuid:=auth.uid(); v_id uuid; v_school public.school_directory;
begin
 if not public.has_role(uid,'admin'::public.app_role) then raise exception 'Acesso reservado a administradores.'; end if;
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
end; $$;
revoke all on function sina_private.create_admin_institution(text,text,uuid) from public,anon;
grant execute on function sina_private.create_admin_institution(text,text,uuid) to authenticated;
create or replace function public.admin_create_institution(_name text,_slug text,_school_directory_id uuid default null)
returns uuid language sql security invoker set search_path to '' as $$ select sina_private.create_admin_institution(_name,_slug,_school_directory_id); $$;
revoke all on function public.admin_create_institution(text,text,uuid) from public,anon;
grant execute on function public.admin_create_institution(text,text,uuid) to authenticated;