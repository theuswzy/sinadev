-- Complete teacher/student subject relationship.
create table if not exists public.classroom_subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(classroom_id, subject_id)
);
create index if not exists classroom_subjects_teacher_idx on public.classroom_subjects(teacher_id, institution_id);
create index if not exists classroom_subjects_student_idx on public.classroom_subjects(classroom_id, subject_id);
alter table public.classroom_subjects enable row level security;

drop policy if exists "Classroom subjects visible to institution members" on public.classroom_subjects;
create policy "Classroom subjects visible to institution members"
on public.classroom_subjects for select to authenticated
using (exists(select 1 from public.institution_memberships m where m.user_id=auth.uid() and m.institution_id=classroom_subjects.institution_id and m.status='active'));

create or replace function public.teacher_list_subject_assignments()
returns table(id uuid,classroom_id uuid,classroom_name text,subject_id uuid,subject_name text,teacher_id uuid)
language sql stable security definer set search_path=''
as $$
 select cs.id,cs.classroom_id,c.name,cs.subject_id,s.name,cs.teacher_id
 from public.classroom_subjects cs
 join public.classrooms c on c.id=cs.classroom_id
 join public.subjects s on s.id=cs.subject_id
 where cs.teacher_id=auth.uid()
   and cs.institution_id=sina_private.current_institution('teacher'::public.app_role)
   and c.status='active' and s.status='active'
 order by c.name,s.name;
$$;

create or replace function public.teacher_assign_subject_to_class(_subject_id uuid,_classroom_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid;
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if not exists(select 1 from public.subjects where id=_subject_id and institution_id=inst and status='active' and created_by=auth.uid()) then
   raise exception 'A disciplina não pertence a você ou está indisponível.';
 end if;
 if not exists(select 1 from public.classrooms c join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid() where c.id=_classroom_id and c.institution_id=inst and c.status='active') then
   raise exception 'A turma não pertence a você.';
 end if;
 insert into public.classroom_subjects(institution_id,classroom_id,subject_id,teacher_id)
 values(inst,_classroom_id,_subject_id,auth.uid())
 on conflict(classroom_id,subject_id) do update set teacher_id=auth.uid()
 returning id into row_id;
 return row_id;
end;
$$;

create or replace function public.teacher_unassign_subject_from_class(_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
 delete from public.classroom_subjects
 where id=_id and teacher_id=auth.uid()
   and institution_id=sina_private.current_institution('teacher'::public.app_role);
 return found;
end;
$$;

create or replace function public.student_list_subjects()
returns table(id uuid,name text,code text,classroom_id uuid,classroom_name text,teacher_id uuid,teacher_name text)
language sql stable security definer set search_path=''
as $$
 select s.id,s.name,s.code,cs.classroom_id,c.name,cs.teacher_id,coalesce(p.display_name,'')
 from public.classroom_subjects cs
 join public.subjects s on s.id=cs.subject_id
 join public.classrooms c on c.id=cs.classroom_id
 join public.students st on st.classroom_id=cs.classroom_id and st.user_id=auth.uid()
 left join public.profiles p on p.user_id=cs.teacher_id
 where cs.institution_id=sina_private.current_institution('student'::public.app_role)
   and s.status='active' and c.status='active'
 order by s.name;
$$;

revoke all on function public.teacher_list_subject_assignments() from public,anon;
revoke all on function public.teacher_assign_subject_to_class(uuid,uuid) from public,anon;
revoke all on function public.teacher_unassign_subject_from_class(uuid) from public,anon;
revoke all on function public.student_list_subjects() from public,anon;
grant execute on function public.teacher_list_subject_assignments() to authenticated;
grant execute on function public.teacher_assign_subject_to_class(uuid,uuid) to authenticated;
grant execute on function public.teacher_unassign_subject_from_class(uuid) to authenticated;
grant execute on function public.student_list_subjects() to authenticated;
