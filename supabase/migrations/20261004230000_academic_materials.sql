-- Academic material library for teachers and students
create table if not exists public.academic_materials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete set null,
  term_id uuid null references public.academic_terms(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '',
  file_path text not null,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  file_type text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academic_materials_institution_classroom_idx
  on public.academic_materials (institution_id, classroom_id, status, created_at desc);
create index if not exists academic_materials_subject_idx
  on public.academic_materials (subject_id, created_at desc);
create index if not exists academic_materials_created_by_idx
  on public.academic_materials (created_by, created_at desc);

alter table public.academic_materials enable row level security;
revoke all on public.academic_materials from public, anon, authenticated;

create or replace function public.teacher_create_academic_material(
  _classroom_id uuid, _subject_id uuid, _term_id uuid, _title text, _description text,
  _file_path text, _file_name text, _file_size bigint, _file_type text
) returns public.academic_materials
language plpgsql security definer set search_path = ''
as $$
declare v_institution uuid; v_row public.academic_materials;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then raise exception 'Acesso permitido somente para professores'; end if;
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  if v_institution is null then raise exception 'Nenhuma instituição ativa encontrada'; end if;
  if _classroom_id is null or not exists (
    select 1 from public.classrooms c
    where c.id=_classroom_id and c.institution_id=v_institution and c.status='active'
      and exists (select 1 from public.classroom_teachers ct where ct.classroom_id=c.id and ct.user_id=auth.uid())
  ) then raise exception 'Você não está vinculado a esta turma'; end if;
  if _subject_id is not null and not exists (
    select 1 from public.classroom_subjects cs
    where cs.classroom_id=_classroom_id and cs.subject_id=_subject_id
      and cs.institution_id=v_institution and cs.teacher_id=auth.uid()
  ) then raise exception 'A disciplina não está vinculada a esta turma para você'; end if;
  if _term_id is not null and not exists (
    select 1 from public.academic_terms t where t.id=_term_id and t.institution_id=v_institution
  ) then raise exception 'Período acadêmico inválido'; end if;
  if _file_path is null or _file_path !~ ('^' || auth.uid()::text || '/materials/') then raise exception 'Caminho de arquivo inválido'; end if;
  if _file_size is null or _file_size <= 0 or _file_size > 20971520 then raise exception 'Arquivo deve ter entre 1 byte e 20 MB'; end if;
  insert into public.academic_materials (
    institution_id,classroom_id,subject_id,term_id,created_by,title,description,file_path,file_name,file_size,file_type
  ) values (
    v_institution,_classroom_id,_subject_id,_term_id,auth.uid(),btrim(_title),coalesce(_description,''),_file_path,btrim(_file_name),_file_size,btrim(_file_type)
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.teacher_list_academic_materials()
returns table (
  id uuid,classroom_id uuid,classroom_name text,subject_id uuid,subject_name text,
  term_id uuid,term_name text,title text,description text,file_path text,file_name text,
  file_size bigint,file_type text,created_at timestamptz,updated_at timestamptz
)
language sql security definer stable set search_path = ''
as $$
  select m.id,m.classroom_id,c.name,m.subject_id,s.name,m.term_id,t.name,m.title,m.description,
         m.file_path,m.file_name,m.file_size,m.file_type,m.created_at,m.updated_at
  from public.academic_materials m
  join public.classrooms c on c.id=m.classroom_id
  left join public.subjects s on s.id=m.subject_id
  left join public.academic_terms t on t.id=m.term_id
  where m.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and m.status='active'
    and (m.created_by=auth.uid() or exists (
      select 1 from public.classroom_teachers ct where ct.classroom_id=m.classroom_id and ct.user_id=auth.uid()
    ))
  order by m.created_at desc;
$$;

create or replace function public.teacher_delete_academic_material(_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_institution uuid; v_path text;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso permitido somente para professores'; end if;
  v_institution:=sina_private.current_institution('teacher'::public.app_role);
  select m.file_path into v_path from public.academic_materials m
  where m.id=_id and m.institution_id=v_institution
    and (m.created_by=auth.uid() or exists (
      select 1 from public.classroom_teachers ct where ct.classroom_id=m.classroom_id and ct.user_id=auth.uid()
    ));
  if v_path is null then raise exception 'Material não encontrado ou sem permissão'; end if;
  update public.academic_materials set status='archived',updated_at=now() where id=_id;
  return true;
end;
$$;

create or replace function public.student_list_academic_materials()
returns table (
  id uuid,classroom_id uuid,classroom_name text,subject_id uuid,subject_name text,
  term_id uuid,term_name text,title text,description text,file_path text,file_name text,
  file_size bigint,file_type text,created_at timestamptz
)
language sql security definer stable set search_path=''
as $$
  select m.id,m.classroom_id,c.name,m.subject_id,s.name,m.term_id,t.name,m.title,m.description,
         m.file_path,m.file_name,m.file_size,m.file_type,m.created_at
  from public.academic_materials m
  join public.students st on st.classroom_id=m.classroom_id and st.user_id=auth.uid()
  join public.classrooms c on c.id=m.classroom_id
  left join public.subjects s on s.id=m.subject_id
  left join public.academic_terms t on t.id=m.term_id
  where st.institution_id=m.institution_id and m.status='active'
  order by m.created_at desc;
$$;

revoke all on function public.teacher_create_academic_material(uuid,uuid,uuid,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_list_academic_materials() from public,anon;
revoke all on function public.teacher_delete_academic_material(uuid) from public,anon;
create or replace function public.student_can_read_academic_material(_path text)
returns boolean language sql security definer stable set search_path=''
as $
  select public.has_role(auth.uid(),'student'::public.app_role)
    and exists (
      select 1 from public.academic_materials m
      join public.students st on st.classroom_id=m.classroom_id and st.user_id=auth.uid()
      where m.file_path=_path and m.status='active' and st.institution_id=m.institution_id
    );
$;
revoke all on function public.student_can_read_academic_material(text) from public,anon;
grant execute on function public.student_can_read_academic_material(text) to authenticated;

revoke all on function public.student_list_academic_materials() from public,anon;
grant execute on function public.teacher_create_academic_material(uuid,uuid,uuid,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_list_academic_materials() to authenticated;
grant execute on function public.teacher_delete_academic_material(uuid) to authenticated;
grant execute on function public.student_list_academic_materials() to authenticated;

drop policy if exists "Students read academic materials" on storage.objects;
create policy "Students read academic materials" on storage.objects for select to authenticated
using (bucket_id='academic-attachments' and public.student_can_read_academic_material(name));
