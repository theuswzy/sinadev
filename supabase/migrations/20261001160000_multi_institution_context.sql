-- SINA: active institution context for multi-institution deployments
create table if not exists public.user_institution_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.user_institution_context enable row level security;

drop policy if exists "Users read own institution context" on public.user_institution_context;
create policy "Users read own institution context"
on public.user_institution_context for select to authenticated
using (user_id = (select auth.uid()));

create or replace function sina_private.current_institution(_role public.app_role default null)
returns uuid
language sql stable security definer set search_path to ''
as $$
  select coalesce(
    (
      select c.institution_id
      from public.user_institution_context c
      join public.institution_memberships m
        on m.institution_id = c.institution_id
       and m.user_id = c.user_id
       and m.status = 'active'
       and (_role is null or m.role = _role)
      where c.user_id = auth.uid()
      limit 1
    ),
    (
      select m.institution_id
      from public.institution_memberships m
      where m.user_id = auth.uid()
        and m.status = 'active'
        and (_role is null or m.role = _role)
      order by case when m.role = 'admin' then 0 when m.role = 'teacher' then 1 else 2 end
      limit 1
    )
  );
$$;

create or replace function public.account_list_institutions()
returns table(id uuid, name text, slug text, status text, role text)
language sql stable security definer set search_path to ''
as $$
  select i.id, i.name, i.slug, i.status, m.role::text
  from public.institutions i
  join public.institution_memberships m on m.institution_id=i.id
  where m.user_id=auth.uid()
    and m.status='active'
    and i.status='active'
  order by i.name;
$$;

create or replace function public.account_set_institution(_institution_id uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
begin
  if not exists (
    select 1 from public.institution_memberships m
    join public.institutions i on i.id=m.institution_id
    where m.user_id=auth.uid()
      and m.institution_id=_institution_id
      and m.status='active'
      and i.status='active'
  ) then
    raise exception 'Você não possui acesso a esta instituição.';
  end if;

  insert into public.user_institution_context(user_id,institution_id)
  values(auth.uid(),_institution_id)
  on conflict(user_id) do update
    set institution_id=excluded.institution_id, updated_at=now();

  return true;
end;
$$;

create or replace function public.admin_create_institution(_name text, _slug text)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;
  if nullif(trim(_name),'') is null or nullif(trim(_slug),'') is null then
    raise exception 'Nome e identificador da instituição são obrigatórios.';
  end if;

  insert into public.institutions(name,slug,status)
  values(trim(_name),lower(trim(_slug)),'active')
  returning id into v_id;

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(v_id,auth.uid(),'admin'::public.app_role,'active')
  on conflict(institution_id,user_id,role) do update set status='active';

  return v_id;
end;
$$;

revoke all on function public.account_list_institutions() from public,anon;
revoke all on function public.account_set_institution(uuid) from public,anon;
revoke all on function public.admin_create_institution(text,text) from public,anon;
grant execute on function public.account_list_institutions() to authenticated;
grant execute on function public.account_set_institution(uuid) to authenticated;
grant execute on function public.admin_create_institution(text,text) to authenticated;
