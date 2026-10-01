-- Allow teachers to create and manage their own classroom workspace.
create or replace function public.teacher_list_classrooms()
returns table(id uuid,name text,code text,status text,student_count bigint)
language sql stable security definer set search_path=''
as $$
  select c.id,c.name,c.code,c.status,count(s.id)::bigint
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  left join public.students s on s.classroom_id=c.id and s.institution_id=c.institution_id
  where c.institution_id=sina_private.current_institution('teacher'::public.app_role)
  group by c.id
  order by c.name;
$$;

create or replace function public.teacher_create_classroom(_name text,_code text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_name),'') is null then raise exception 'Informe o nome da turma.'; end if;
  if exists(select 1 from public.classrooms where institution_id=inst and lower(name)=lower(trim(_name)) and status='active') then
    raise exception 'Já existe uma turma com esse nome nesta instituição.';
  end if;
  insert into public.classrooms(institution_id,name,code,status) values(inst,trim(_name),nullif(trim(_code),''),'active') returning id into classroom_id;
  insert into public.classroom_teachers(classroom_id,user_id) values(classroom_id,auth.uid()) on conflict do nothing;
  return classroom_id;
end;
$$;

revoke all on function public.teacher_create_classroom(text,text) from public,anon;
grant execute on function public.teacher_create_classroom(text,text) to authenticated;