create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_user_id uuid, action text not null, table_name text not null, record_id uuid, old_data jsonb, new_data jsonb, created_at timestamptz not null default now());
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create index audit_logs_actor_created_idx on public.audit_logs(actor_user_id,created_at desc);
create index audit_logs_table_record_idx on public.audit_logs(table_name,record_id,created_at desc);

create or replace function public.write_academic_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); record_id_value uuid; old_payload jsonb; new_payload jsonb;
begin
 record_id_value := coalesce(new.id,old.id);
 old_payload := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
 new_payload := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
 if tg_table_name='students' then old_payload:=old_payload-'claim_code'; new_payload:=new_payload-'claim_code'; end if;
 insert into public.audit_logs(actor_user_id,action,table_name,record_id,old_data,new_data) values(actor,tg_op,tg_table_name,record_id_value,old_payload,new_payload);
 return coalesce(new,old);
end; $$;
revoke all on function public.write_academic_audit() from public,anon,authenticated;
grant execute on function public.write_academic_audit() to postgres;
create trigger students_audit_trigger after insert or update or delete on public.students for each row execute function public.write_academic_audit();
create trigger grades_audit_trigger after insert or update or delete on public.grades for each row execute function public.write_academic_audit();

create or replace function sina_private.list_admin_audit_logs(_limit integer default 100)
returns setof public.audit_logs language plpgsql security definer set search_path = '' as $$
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso reservado a administradores.'; end if;
 return query select * from public.audit_logs order by created_at desc limit greatest(1,least(coalesce(_limit,100),250));
end; $$;
revoke all on function sina_private.list_admin_audit_logs(integer) from public,anon;
grant execute on function sina_private.list_admin_audit_logs(integer) to authenticated;
create or replace function public.admin_list_audit_logs(_limit integer default 100)
returns setof public.audit_logs language sql stable security invoker set search_path = '' as $$ select * from sina_private.list_admin_audit_logs(_limit); $$;
revoke all on function public.admin_list_audit_logs(integer) from public,anon;
grant execute on function public.admin_list_audit_logs(integer) to authenticated;