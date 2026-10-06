-- SINA: lock student/teacher institution context to their academic home school.
-- Admins may manage multiple institutions; students and teachers must not
-- receive a school switcher or change tenant through the context RPC.

create or replace function public.account_list_institutions()
returns table(id uuid, name text, slug text, status text, role text, is_active boolean)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  current_role text;
  home_institution uuid;
  active_context uuid;
begin
  if uid is null then
    return;
  end if;

  select ur.role::text into current_role
  from public.user_roles ur
  where ur.user_id = uid
    and ur.role in ('admin','teacher','student')
  order by case when ur.role='admin' then 0 when ur.role='teacher' then 1 else 2 end
  limit 1;

  select c.institution_id into active_context
  from public.user_institution_context c
  join public.institution_memberships m
    on m.user_id = c.user_id
   and m.institution_id = c.institution_id
   and m.status = 'active'
  join public.institutions i on i.id = c.institution_id and i.status = 'active'
  where c.user_id = uid
  limit 1;

  if current_role = 'admin' then
    return query
      select i.id, i.name, i.slug, i.status, m.role::text,
             (i.id = active_context) as is_active
      from public.institutions i
      join public.institution_memberships m on m.institution_id = i.id
      where m.user_id = uid
        and m.status = 'active'
        and i.status = 'active'
      order by case when i.id = active_context then 0 else 1 end, i.name;
    return;
  end if;

  if current_role = 'student' then
    select s.institution_id into home_institution
    from public.students s
    where s.user_id = uid
      and s.institution_id is not null
    order by s.updated_at desc nulls last
    limit 1;
  elsif current_role = 'teacher' then
    -- A teacher's home school is the institution represented by their
    -- classroom assignments. Prefer the active context when it is valid.
    if active_context is not null then
      select active_context into home_institution;
    else
      select m.institution_id into home_institution
      from public.institution_memberships m
      where m.user_id = uid
        and m.role = 'teacher'::public.app_role
        and m.status = 'active'
      order by m.updated_at desc nulls last
      limit 1;
    end if;
  end if;

  if home_institution is null then
    select m.institution_id into home_institution
    from public.institution_memberships m
    where m.user_id = uid
      and m.status = 'active'
      and (current_role is null or m.role = current_role::public.app_role)
    order by m.updated_at desc nulls last
    limit 1;
  end if;

  return query
    select i.id, i.name, i.slug, i.status, m.role::text, true
    from public.institutions i
    join public.institution_memberships m
      on m.institution_id = i.id
     and m.user_id = uid
     and m.status = 'active'
    where i.id = home_institution
      and i.status = 'active'
    limit 1;
end;
$$;

create or replace function public.account_set_institution(_institution_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  current_role text;
  home_institution uuid;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;

  select ur.role::text into current_role
  from public.user_roles ur
  where ur.user_id = uid
    and ur.role in ('admin','teacher','student')
  order by case when ur.role='admin' then 0 when ur.role='teacher' then 1 else 2 end
  limit 1;

  if current_role = 'admin' then
    if not exists (
      select 1 from public.institution_memberships m
      join public.institutions i on i.id = m.institution_id
      where m.user_id = uid and m.institution_id = _institution_id
        and m.status = 'active' and i.status = 'active'
    ) then
      raise exception 'Você não possui acesso a esta instituição.';
    end if;
  else
    if current_role = 'student' then
      select s.institution_id into home_institution
      from public.students s
      where s.user_id = uid and s.institution_id is not null
      order by s.updated_at desc nulls last limit 1;
    elsif current_role = 'teacher' then
      select c.institution_id into home_institution
      from public.user_institution_context c
      where c.user_id = uid
      limit 1;
      if home_institution is null then
        select m.institution_id into home_institution
        from public.institution_memberships m
        where m.user_id = uid and m.role = 'teacher'::public.app_role and m.status = 'active'
        order by m.updated_at desc nulls last limit 1;
      end if;
    end if;

    if home_institution is null or _institution_id <> home_institution then
      raise exception 'Sua conta está vinculada a uma única instituição.';
    end if;
  end if;

  insert into public.user_institution_context(user_id, institution_id)
  values(uid, _institution_id)
  on conflict(user_id) do update
    set institution_id = excluded.institution_id, updated_at = now();

  return true;
end;
$$;

revoke all on function public.account_list_institutions() from public, anon;
revoke all on function public.account_set_institution(uuid) from public, anon;
grant execute on function public.account_list_institutions() to authenticated;
grant execute on function public.account_set_institution(uuid) to authenticated;
