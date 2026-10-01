-- Teachers can use institution disciplines created by admins; only their own disciplines can be edited/archived.
create or replace function public.teacher_list_subjects()
returns table(id uuid,name text,code text,status text,created_by uuid)
language sql stable security definer set search_path=''
as $$ select s.id,s.name,s.code,s.status,s.created_by from public.subjects s where s.institution_id=sina_private.current_institution('teacher'::public.app_role) and s.status='active' order by s.name; $$;

create or replace function public.teacher_assign_subject_to_class(_subject_id uuid,_classroom_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare inst uuid; row_id uuid;
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if not exists(select 1 from public.subjects where id=_subject_id and institution_id=inst and status='active') then raise exception 'Disciplina indisponível nesta instituição.'; end if;
 if not exists(select 1 from public.classrooms c join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid() where c.id=_classroom_id and c.institution_id=inst and c.status='active') then raise exception 'A turma não pertence a você.'; end if;
 insert into public.classroom_subjects(institution_id,classroom_id,subject_id,teacher_id) values(inst,_classroom_id,_subject_id,auth.uid()) on conflict(classroom_id,subject_id) do update set teacher_id=auth.uid() returning id into row_id;
 return row_id;
end; $$;