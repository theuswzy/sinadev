create or replace function public.account_list_institutions()
returns table(id uuid,name text,slug text,status text,role text,is_active boolean)
language sql stable security definer set search_path to ''
as $$
select i.id,i.name,i.slug,i.status,m.role::text,
       coalesce(c.institution_id=i.id,false) as is_active
from public.institutions i
join public.institution_memberships m on m.institution_id=i.id
left join public.user_institution_context c on c.user_id=auth.uid()
where m.user_id=auth.uid() and m.status='active' and i.status='active'
order by case when coalesce(c.institution_id=i.id,false) then 0 else 1 end,i.name;
$$;

revoke all on function public.account_list_institutions() from public,anon;
grant execute on function public.account_list_institutions() to authenticated;
