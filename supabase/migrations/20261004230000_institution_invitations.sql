-- SINA institutional invitations.
create table if not exists public.institution_invitations (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 invited_by uuid not null references auth.users(id) on delete cascade,
 email text not null,
 role public.app_role not null,
 classroom_id uuid null references public.classrooms(id) on delete set null,
 token_hash text not null unique,
 expires_at timestamptz not null,
 accepted_at timestamptz null,
 accepted_by uuid null references auth.users(id) on delete set null,
 revoked_at timestamptz null,
 created_at timestamptz not null default now(),
 constraint institution_invitations_role_check check (role in ('teacher'::public.app_role,'student'::public.app_role)),
 constraint institution_invitations_email_check check (position('@' in email) > 1)
);
create index if not exists institution_invitations_institution_status_idx on public.institution_invitations(institution_id,revoked_at,accepted_at,expires_at);
create index if not exists institution_invitations_email_idx on public.institution_invitations(lower(email));
alter table public.institution_invitations enable row level security;
revoke all on public.institution_invitations from public,anon,authenticated;

create or replace function public.admin_create_institution_invitation(_email text,_role text,_classroom_id uuid default null,_expires_hours integer default 72)
returns table(invitation_id uuid,token text,expires_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare inst uuid; normalized_email text; raw_token text; hashed_token text; exp timestamptz;
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso reservado a administradores.'; end if;
 inst:=sina_private.current_institution('admin'::public.app_role);
 if inst is null then raise exception 'Administrador sem instituição ativa.'; end if;
 normalized_email:=lower(trim(_email));
 if normalized_email='' or position('@' in normalized_email)<2 then raise exception 'Informe um e-mail válido.'; end if;
 if _role not in ('teacher','student') then raise exception 'Tipo de convite inválido.'; end if;
 if _expires_hours<1 or _expires_hours>720 then raise exception 'Validade do convite deve ficar entre 1 e 720 horas.'; end if;
 if _classroom_id is not null and not exists(select 1 from public.classrooms c where c.id=_classroom_id and c.institution_id=inst and c.status='active') then raise exception 'Turma inválida para a instituição ativa.'; end if;
 if exists(select 1 from public.institution_invitations i where i.institution_id=inst and lower(i.email)=normalized_email and i.accepted_at is null and i.revoked_at is null and i.expires_at>now()) then raise exception 'Já existe um convite ativo para este e-mail.'; end if;
 raw_token:=encode(gen_random_bytes(32),'hex'); hashed_token:=encode(digest(raw_token,'sha256'),'hex'); exp:=now()+make_interval(hours=>_expires_hours);
 insert into public.institution_invitations(institution_id,invited_by,email,role,classroom_id,token_hash,expires_at) values(inst,auth.uid(),normalized_email,_role::public.app_role,_classroom_id,hashed_token,exp) returning id,expires_at into invitation_id,expires_at;
 token:=raw_token; return next;
end;
$$;
revoke execute on function public.admin_create_institution_invitation(text,text,uuid,integer) from public,anon;
grant execute on function public.admin_create_institution_invitation(text,text,uuid,integer) to authenticated;

create or replace function public.admin_list_institution_invitations()
returns table(id uuid,email text,role text,classroom_id uuid,classroom_name text,expires_at timestamptz,accepted_at timestamptz,revoked_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select i.id,i.email,i.role::text,i.classroom_id,c.name,i.expires_at,i.accepted_at,i.revoked_at,i.created_at
 from public.institution_invitations i left join public.classrooms c on c.id=i.classroom_id
 where i.institution_id=sina_private.current_institution('admin'::public.app_role)
 order by i.created_at desc limit 200;
$$;
revoke execute on function public.admin_list_institution_invitations() from public,anon;
grant execute on function public.admin_list_institution_invitations() to authenticated;

create or replace function public.admin_revoke_institution_invitation(_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso reservado a administradores.'; end if;
 if not exists(select 1 from public.institution_invitations i where i.id=_id and i.institution_id=sina_private.current_institution('admin'::public.app_role) and i.accepted_at is null and i.revoked_at is null) then raise exception 'Convite não encontrado ou já encerrado.'; end if;
 update public.institution_invitations set revoked_at=now() where id=_id;
 return true;
end;
$$;
revoke execute on function public.admin_revoke_institution_invitation(uuid) from public,anon;
grant execute on function public.admin_revoke_institution_invitation(uuid) to authenticated;

create or replace function public.accept_institution_invitation(_token text)
returns table(institution_id uuid,institution_name text,role text,classroom_id uuid,classroom_name text)
language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); invite public.institution_invitations%rowtype; email_claim text; inst_name text;
begin
 if uid is null then raise exception 'Faça login antes de aceitar o convite.'; end if;
 email_claim:=lower(trim(coalesce(auth.jwt()->>'email','')));
 if email_claim='' then raise exception 'Não foi possível validar o e-mail da conta.'; end if;
 select * into invite from public.institution_invitations i where i.token_hash=encode(digest(trim(_token),'sha256'),'hex') and i.accepted_at is null and i.revoked_at is null and i.expires_at>now() for update;
 if not found then raise exception 'Convite inválido, expirado ou já utilizado.'; end if;
 if lower(invite.email)<>email_claim then raise exception 'Este convite foi enviado para outro e-mail.'; end if;
 select name into inst_name from public.institutions where id=invite.institution_id and status='active';
 if inst_name is null then raise exception 'A instituição do convite não está ativa.'; end if;
 if invite.classroom_id is not null and not exists(select 1 from public.classrooms where id=invite.classroom_id and institution_id=invite.institution_id and status='active') then raise exception 'A turma vinculada ao convite não está disponível.'; end if;
 insert into public.user_roles(user_id,role) values(uid,invite.role) on conflict(user_id,role) do nothing;
 insert into public.institution_memberships(institution_id,user_id,role,status) values(invite.institution_id,uid,invite.role,'active') on conflict(institution_id,user_id,role) do update set status='active',updated_at=now();
 insert into public.user_institution_context(user_id,institution_id) values(uid,invite.institution_id) on conflict(user_id) do update set institution_id=excluded.institution_id,updated_at=now();
 if invite.role='student' and invite.classroom_id is not null then
   update public.students set institution_id=invite.institution_id,classroom_id=invite.classroom_id,classroom=(select name from public.classrooms where id=invite.classroom_id),teacher_id=null,updated_at=now() where user_id=uid;
 end if;
 update public.institution_invitations set accepted_at=now(),accepted_by=uid where id=invite.id;
 return query select invite.institution_id,inst_name,invite.role::text,invite.classroom_id,(select c.name from public.classrooms c where c.id=invite.classroom_id);
end;
$$;
revoke execute on function public.accept_institution_invitation(text) from public,anon;
grant execute on function public.accept_institution_invitation(text) to authenticated;
