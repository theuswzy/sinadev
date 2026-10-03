create or replace function sina_private.list_account_institutions()
returns table(id uuid,name text,slug text,status text,role text,is_active boolean)
language sql stable security definer set search_path to '' as $$
select i.id,i.name,i.slug,i.status,m.role::text,
       i.id=sina_private.current_institution(m.role) as is_active
from public.institutions i join public.institution_memberships m on m.institution_id=i.id
where m.user_id=auth.uid() and m.status='active' and i.status='active'
order by i.name;
$$;
create or replace function sina_private.set_account_institution(_institution_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
begin
if not exists (select 1 from public.institution_memberships m join public.institutions i on i.id=m.institution_id where m.user_id=auth.uid() and m.institution_id=_institution_id and m.status='active' and i.status='active') then raise exception 'Você não possui acesso a esta instituição.'; end if;
insert into public.user_institution_context(user_id,institution_id) values(auth.uid(),_institution_id) on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();
return true;
end;
$$;
revoke all on function sina_private.list_account_institutions() from public,anon;
revoke all on function sina_private.set_account_institution(uuid) from public,anon;
grant execute on function sina_private.list_account_institutions() to authenticated;
grant execute on function sina_private.set_account_institution(uuid) to authenticated;

create or replace function public.account_list_institutions()
returns table(id uuid,name text,slug text,status text,role text,is_active boolean)
language sql stable security invoker set search_path to '' as $$
select * from sina_private.list_account_institutions();
$$;
create or replace function public.account_set_institution(_institution_id uuid)
returns boolean language sql security invoker set search_path to '' as $$
select sina_private.set_account_institution(_institution_id);
$$;