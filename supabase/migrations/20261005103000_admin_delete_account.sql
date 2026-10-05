-- Admin account deletion with server-side authorization and cleanup.
-- The account itself is removed from auth.users; linked academic records are
-- cleaned according to their ownership semantics. Administrator accounts and
-- the currently logged-in administrator are protected.

create or replace function sina_private.delete_account(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_email text;
  target_name text;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if _user_id is null then
    raise exception 'Conta inválida.';
  end if;

  if _user_id = auth.uid() then
    raise exception 'O administrador conectado não pode excluir a própria conta.';
  end if;

  if public.has_role(_user_id, 'admin'::public.app_role) then
    raise exception 'Contas administrativas não podem ser excluídas por esta tela.';
  end if;

  select
    coalesce(au.email::text, ''),
    coalesce(p.display_name, '')
  into target_email, target_name
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  where au.id = _user_id
  limit 1;

  if target_email is null then
    raise exception 'Conta não encontrada.';
  end if;

  insert into public.audit_logs(action, table_name, record_id, actor_user_id, old_data, new_data)
  values (
    'DELETE',
    'auth.users',
    _user_id,
    auth.uid(),
    jsonb_build_object('email', target_email, 'display_name', target_name),
    null
  );

  -- Remove records that deliberately use RESTRICT/NO ACTION foreign keys.
  delete from public.academic_materials where created_by = _user_id;
  update public.subjects set created_by = null where created_by = _user_id;
  update public.students set teacher_id = null where teacher_id = _user_id;
  delete from public.students where user_id = _user_id;

  -- Remaining account-scoped records use CASCADE/SET NULL from auth.users.
  delete from auth.users where id = _user_id;

  return true;
end;
$function$;

create or replace function public.admin_delete_account(_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select sina_private.delete_account(_user_id)
$function$;

revoke all on function public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_delete_account(uuid) to authenticated;
