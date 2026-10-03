create table public.user_institution_context (user_id uuid primary key, institution_id uuid not null references public.institutions(id) on delete cascade, updated_at timestamptz not null default now());
grant select on public.user_institution_context to authenticated;
grant all on public.user_institution_context to service_role;
alter table public.user_institution_context enable row level security;
create policy "Users read own institution context" on public.user_institution_context for select to authenticated using (user_id = (select auth.uid()));

create or replace function sina_private.current_institution(_role public.app_role default null)
returns uuid language sql stable security definer set search_path to '' as $$
  select coalesce(
    (select c.institution_id from public.user_institution_context c
     join public.institution_memberships m on m.institution_id=c.institution_id and m.user_id=c.user_id and m.status='active' and (_role is null or m.role=_role)
     where c.user_id=auth.uid() limit 1),
    (select m.institution_id from public.institution_memberships m where m.user_id=auth.uid() and m.status='active' and (_role is null or m.role=_role)
     order by case when m.role='admin' then 0 when m.role='teacher' then 1 else 2 end limit 1)
  );
$$;

create or replace function public.account_list_institutions()
returns table(id uuid,name text,slug text,status text,role text,is_active boolean)
language sql stable security definer set search_path to '' as $$
select i.id,i.name,i.slug,i.status,m.role::text,
       i.id=sina_private.current_institution(m.role) as is_active
from public.institutions i join public.institution_memberships m on m.institution_id=i.id
where m.user_id=auth.uid() and m.status='active' and i.status='active'
order by i.name;
$$;
revoke all on function public.account_list_institutions() from public,anon;
grant execute on function public.account_list_institutions() to authenticated;

create or replace function public.account_set_institution(_institution_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
begin
if not exists (select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id where m.user_id=auth.uid() and m.institution_id=_institution_id and m.status='active' and i.status='active') then raise exception 'Você não possui acesso a esta instituição.'; end if;
insert into public.user_institution_context(user_id,institution_id) values(auth.uid(),_institution_id) on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();
return true;
end;
$$;
revoke all on function public.account_set_institution(uuid) from public,anon;
grant execute on function public.account_set_institution(uuid) to authenticated;