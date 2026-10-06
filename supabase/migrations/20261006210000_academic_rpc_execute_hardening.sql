-- Exposed academic RPCs must never be callable anonymously.
-- The function bodies already enforce authentication, but execution privileges
-- should also reject unauthenticated callers as defense in depth.

do $$
declare
  fn record;
begin
  for fn in
    select p.proname,pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (
        p.proname like 'admin_%'
        or p.proname like 'teacher_%'
        or p.proname like 'student_%'
      )
  loop
    execute format('revoke execute on function public.%I(%s) from public,anon',fn.proname,fn.args);
    execute format('grant execute on function public.%I(%s) to authenticated',fn.proname,fn.args);
  end loop;
end
$$;
