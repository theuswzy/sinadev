-- SINA: server-side pagination for large academic rosters.

create or replace function public.admin_list_students_page(_search text default '', _only_without_class boolean default false, _page integer default 1, _page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inst uuid;
  v_page integer := greatest(coalesce(_page,1),1);
  v_size integer := least(greatest(coalesce(_page_size,25),1),100);
  v_search text := lower(trim(coalesce(_search,'')));
  v_total bigint;
  v_items jsonb;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito ao administrador.'; end if;
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
    select s.id,s.user_id,s.full_name,s.enrollment,s.classroom_id,c.name as classroom_name,
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
$$;

create or replace function public.teacher_list_institution_students_page(_search text default '', _class_status text default '', _page integer default 1, _page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inst uuid;
  v_page integer := greatest(coalesce(_page,1),1);
  v_size integer := least(greatest(coalesce(_page_size,25),1),100);
  v_search text := lower(trim(coalesce(_search,'')));
  v_status text := lower(trim(coalesce(_class_status,'')));
  v_total bigint;
  v_items jsonb;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor.'; end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Nenhuma instituição ativa encontrada.'; end if;

  with roster as (
    select s.id,s.full_name,s.enrollment,s.classroom,s.classroom_id,s.attendance,s.teacher_id,
      case
        when s.classroom_id is null then 'sem_turma'
        when exists (
          select 1 from public.classroom_teachers ct
          join public.classrooms c on c.id=ct.classroom_id
          where ct.classroom_id=s.classroom_id and ct.user_id=auth.uid()
            and c.institution_id=s.institution_id and c.status='active'
        ) then 'minha_turma'
        when exists (
          select 1 from public.classroom_teachers ct
          join public.classrooms c on c.id=ct.classroom_id
          where ct.classroom_id=s.classroom_id
            and c.institution_id=s.institution_id and c.status='active'
        ) then 'outra_turma'
        else 'sem_turma'
      end as class_status
    from public.students s
    where s.institution_id=inst
  )
  select count(*) into v_total from roster
  where (v_search='' or lower(concat_ws(' ',full_name,enrollment,classroom)) like '%'||v_search||'%')
    and (v_status='' or class_status=v_status);

  with roster as (
    select s.id,s.full_name,s.enrollment,s.classroom,s.classroom_id,s.attendance,s.teacher_id,
      case
        when s.classroom_id is null then 'sem_turma'
        when exists (
          select 1 from public.classroom_teachers ct
          join public.classrooms c on c.id=ct.classroom_id
          where ct.classroom_id=s.classroom_id and ct.user_id=auth.uid()
            and c.institution_id=s.institution_id and c.status='active'
        ) then 'minha_turma'
        when exists (
          select 1 from public.classroom_teachers ct
          join public.classrooms c on c.id=ct.classroom_id
          where ct.classroom_id=s.classroom_id
            and c.institution_id=s.institution_id and c.status='active'
        ) then 'outra_turma'
        else 'sem_turma'
      end as class_status
    from public.students s
    where s.institution_id=inst
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by lower(x.full_name)),'[]'::jsonb) into v_items
  from (
    select * from roster
    where (v_search='' or lower(concat_ws(' ',full_name,enrollment,classroom)) like '%'||v_search||'%')
      and (v_status='' or class_status=v_status)
    order by lower(full_name)
    offset (v_page-1)*v_size limit v_size
  ) x;

  return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'page_size',v_size);
end;
$$;

revoke execute on function public.admin_list_students_page(text,boolean,integer,integer) from public,anon;
revoke execute on function public.teacher_list_institution_students_page(text,text,integer,integer) from public,anon;
grant execute on function public.admin_list_students_page(text,boolean,integer,integer) to authenticated;
grant execute on function public.teacher_list_institution_students_page(text,text,integer,integer) to authenticated;
