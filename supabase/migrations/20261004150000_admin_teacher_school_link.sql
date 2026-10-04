-- SINA: administrator-managed teacher-to-school links.
-- Teachers can belong to one or more institutions; the selected institution
-- becomes the teacher's active context without destroying other memberships.

create or replace function public.admin_list_teacher_school_links()
returns table(
  user_id uuid,
  display_name text,
  email text,
  institution_id uuid,
  institution_name text,
  school_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  select
    u.id,
    coalesce(nullif(p.display_name,''), split_part(coalesce(u.email,''),'@',1)) as display_name,
    coalesce(u.email,'') as email,
    coalesce(ctx.institution_id, first_membership.institution_id) as institution_id,
    coalesce(ctx.institution_name, first_membership.institution_name) as institution_name,
    coalesce(all_memberships.school_count,0)::bigint as school_count
  from auth.users u
  left join public.profiles p on p.user_id=u.id
  left join lateral (
    select m.institution_id, i.name as institution_name
    from public.institution_memberships m
    join public.institutions i on i.id=m.institution_id and i.status='active'
    where m.user_id=u.id and m.role='teacher'::public.app_role and m.status='active'
    order by m.updated_at desc, i.name
    limit 1
  ) first_membership on true
  left join lateral (
    select c.institution_id, i.name as institution_name
    from public.user_institution_context c
    join public.institution_memberships m on m.user_id=c.user_id and m.institution_id=c.institution_id and m.role='teacher'::public.app_role and m.status='active'
    join public.institutions i on i.id=c.institution_id and i.status='active'
    where c.user_id=u.id
    limit 1
  ) ctx on true
  left join lateral (
    select count(*) as school_count
    from public.institution_memberships m
    join public.institutions i on i.id=m.institution_id and i.status='active'
    where m.user_id=u.id and m.role='teacher'::public.app_role and m.status='active'
  ) all_memberships on true
  where public.has_role(auth.uid(),'admin'::public.app_role)
    and exists (
      select 1 from public.institution_memberships tm
      where tm.user_id=u.id and tm.role='teacher'::public.app_role and tm.status='active'
    )
  order by lower(coalesce(nullif(p.display_name,''),coalesce(u.email,'')));
$$;

create or replace function public.admin_link_teacher_to_institution(
  _teacher_id uuid,
  _institution_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if not exists (
    select 1 from public.institution_memberships m
    where m.user_id=auth.uid()
      and m.institution_id=_institution_id
      and m.role='admin'::public.app_role
      and m.status='active'
  ) then
    raise exception 'Você não é administrador desta escola.';
  end if;

  if not exists (select 1 from auth.users where id=_teacher_id) then
    raise exception 'Professor não encontrado.';
  end if;

  if not exists (
    select 1 from public.institution_memberships m
    where m.user_id=_teacher_id
      and m.role='teacher'::public.app_role
      and m.status='active'
  ) then
    raise exception 'A conta selecionada não possui função de professor ativa.';
  end if;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(_institution_id,_teacher_id,'teacher'::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(_teacher_id,_institution_id)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$$;

revoke all on function public.admin_list_teacher_school_links() from public,anon;
revoke all on function public.admin_link_teacher_to_institution(uuid,uuid) from public,anon;
grant execute on function public.admin_list_teacher_school_links() to authenticated;
grant execute on function public.admin_link_teacher_to_institution(uuid,uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='institution_memberships') then
    execute 'alter publication supabase_realtime add table public.institution_memberships';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_institution_context') then
    execute 'alter publication supabase_realtime add table public.user_institution_context';
  end if;
end;
$$;
