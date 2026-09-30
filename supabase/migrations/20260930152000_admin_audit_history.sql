-- SINA: administrator-only audit history.

create or replace function public.write_academic_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  record_id_value uuid;
  old_payload jsonb;
  new_payload jsonb;
begin
  record_id_value := coalesce(new.id, old.id);
  old_payload := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_payload := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  if tg_table_name = 'students' then
    old_payload := old_payload - 'claim_code';
    new_payload := new_payload - 'claim_code';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    actor,
    tg_op,
    tg_table_name,
    record_id_value,
    old_payload,
    new_payload
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.write_academic_audit() from public, anon, authenticated;
grant execute on function public.write_academic_audit() to postgres;

create or replace function public.admin_list_audit_logs(_limit integer default 100)
returns setof public.audit_logs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  return query
    select *
    from public.audit_logs
    order by created_at desc
    limit greatest(1, least(coalesce(_limit, 100), 250));
end;
$$;

revoke all on function public.admin_list_audit_logs(integer) from public, anon;
grant execute on function public.admin_list_audit_logs(integer) to authenticated;
