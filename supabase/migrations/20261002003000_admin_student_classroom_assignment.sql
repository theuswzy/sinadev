-- Admin student enrollment into a classroom.
create or replace function public.admin_list_students()
returns table(id uuid,user_id uuid,full_name text,enrollment text,classroom_id uuid,classroom_name text,status text)
language sql stable security definer set search_path=''
as $$
 select s.id,s.user_id,s.full_name,s.enrollment,s.classroom_id,c.name,
   case when c.id is null then 'sem_turma' else 'matriculado' end
 from public.students s
 left join public.classrooms c on c.id=s.classroom_id and c.institution_id=s.institution_id
 where s.institution_id=sina_private.current_institution('admin'::public.app_role)
 order by lower(s.full_name);
$$;

create or replace function public.admin_assign_student_to_classroom(_student_id uuid,_classroom_id uuid,_enrollment text default null)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid; classroom_name text;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito a administradores.'; end if;
 inst:=sina_private.current_institution('admin'::public.app_role);
 select c.name into classroom_name from public.classrooms c where c.id=_classroom_id and c.institution_id=inst and c.status='active';
 if classroom_name is null then raise exception 'Turma inválida.'; end if;
 update public.students set classroom_id=_classroom_id,classroom=classroom_name,enrollment=coalesce(nullif(trim(_enrollment),''),enrollment),updated_at=now()
 where id=_student_id and institution_id=inst;
 if not found then raise exception 'Aluno não encontrado na instituição ativa.'; end if;
 return true;
end;
$$;

create or replace function public.admin_remove_student_from_classroom(_student_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito a administradores.'; end if;
 inst:=sina_private.current_institution('admin'::public.app_role);
 update public.students set classroom_id=null,classroom='',teacher_id=null,updated_at=now() where id=_student_id and institution_id=inst;
 return found;
end;
$$;

revoke all on function public.admin_list_students() from public,anon;
revoke all on function public.admin_assign_student_to_classroom(uuid,uuid,text) from public,anon;
revoke all on function public.admin_remove_student_from_classroom(uuid) from public,anon;
grant execute on function public.admin_list_students() to authenticated;
grant execute on function public.admin_assign_student_to_classroom(uuid,uuid,text) to authenticated;
grant execute on function public.admin_remove_student_from_classroom(uuid) to authenticated;