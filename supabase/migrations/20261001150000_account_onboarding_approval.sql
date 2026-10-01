create table if not exists public.account_role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_role public.app_role not null check (requested_role in ('student','teacher')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_role_requests_one_pending_per_user_idx
on public.account_role_requests(user_id)
where status='pending';

create index if not exists account_role_requests_status_created_idx
on public.account_role_requests(status,created_at desc);

alter table public.account_role_requests enable row level security;

drop policy if exists "Users can view their role requests" on public.account_role_requests;
create policy "Users can view their role requests"
on public.account_role_requests for select to authenticated
using ((select auth.uid())=user_id);

-- Keep one authoritative onboarding RPC. The previous zero-argument overload is retired.
drop function if exists public.ensure_account_onboarding();

create or replace function public.ensure_account_onboarding(_requested_role text default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  requested text;
  display_name text;
  current_status text;
  current_role text;
  request_row public.account_role_requests;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;

  select coalesce(nullif(_requested_role,''),nullif(au.raw_user_meta_data->>'requested_role',''),'student'),
         coalesce(nullif(p.display_name,''),nullif(au.raw_user_meta_data->>'display_name',''),split_part(coalesce(au.email,''),'@',1)),
         p.status
  into requested,display_name,current_status
  from auth.users au left join public.profiles p on p.user_id=au.id where au.id=uid;

  if requested not in ('student','teacher') then requested:='student'; end if;

  select r.role::text into current_role
  from public.user_roles r where r.user_id=uid and r.role in ('admin','teacher','student')
  order by case when r.role='admin' then 0 when r.role='teacher' then 1 else 2 end limit 1;

  if current_role is not null then
    insert into public.profiles(user_id,display_name,status)
    values(uid,display_name,'active')
    on conflict(user_id) do update set
      display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
      status=case when public.profiles.status='pending' then 'active' else public.profiles.status end,
      updated_at=now();
    current_status:=coalesce((select p.status from public.profiles p where p.user_id=uid),'active');
  else
    insert into public.profiles(user_id,display_name,status)
    values(uid,display_name,'pending')
    on conflict(user_id) do update set
      display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
      status='pending',updated_at=now();
    current_status:='pending';

    select * into request_row
    from public.account_role_requests
    where user_id=uid and status='pending'
    order by created_at desc limit 1;

    if request_row.id is null then
      insert into public.account_role_requests(user_id,requested_role,status)
      values(uid,requested::public.app_role,'pending')
      returning * into request_row;
    elsif _requested_role is not null and request_row.requested_role::text<>requested then
      update public.account_role_requests set requested_role=requested::public.app_role,updated_at=now()
      where id=request_row.id returning * into request_row;
    end if;
  end if;

  return jsonb_build_object(
    'status',current_status,
    'role',current_role,
    'requested_role',coalesce(request_row.requested_role::text,current_role),
    'request_status',coalesce(request_row.status,case when current_role is not null then 'approved' else 'pending' end),
    'request_id',request_row.id,
    'review_note',request_row.review_note
  );
end;
$$;

create or replace function public.account_get_onboarding_state()
returns jsonb
language sql stable security definer set search_path=''
as $$
select jsonb_build_object(
  'status',coalesce(p.status,'pending'),
  'role',(select r.role::text from public.user_roles r where r.user_id=auth.uid() order by case when r.role='admin' then 0 when r.role='teacher' then 1 else 2 end limit 1),
  'requested_role',(select rr.requested_role::text from public.account_role_requests rr where rr.user_id=auth.uid() order by rr.created_at desc limit 1),
  'request_status',(select rr.status from public.account_role_requests rr where rr.user_id=auth.uid() order by rr.created_at desc limit 1),
  'review_note',(select rr.review_note from public.account_role_requests rr where rr.user_id=auth.uid() order by rr.created_at desc limit 1)
)
from public.profiles p where p.user_id=auth.uid();
$$;

create or replace function public.account_resubmit_role_request(_requested_role text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if _requested_role not in ('student','teacher') then raise exception 'Função solicitada inválida.'; end if;
  if exists(select 1 from public.user_roles r where r.user_id=uid and r.role in ('admin','teacher','student')) then return false; end if;

  update public.account_role_requests set status='cancelled',updated_at=now() where user_id=uid and status='pending';
  insert into public.account_role_requests(user_id,requested_role,status) values(uid,_requested_role::public.app_role,'pending');
  update public.profiles set status='pending',updated_at=now() where user_id=uid;
  return true;
end;
$$;

create or replace function public.admin_list_role_requests()
returns table(id uuid,user_id uuid,email text,display_name text,requested_role text,status text,review_note text,created_at timestamptz,reviewed_at timestamptz)
language sql stable security definer set search_path=''
as $$
select rr.id,rr.user_id,au.email::text,coalesce(p.display_name,''),rr.requested_role::text,rr.status,rr.review_note,rr.created_at,rr.reviewed_at
from public.account_role_requests rr
join auth.users au on au.id=rr.user_id
left join public.profiles p on p.user_id=rr.user_id
where public.has_role(auth.uid(),'admin'::public.app_role)
order by case when rr.status='pending' then 0 else 1 end,rr.created_at desc;
$$;

create or replace function public.ensure_student_profile_for_user(_user_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_institution uuid; display_name text;
begin
  select id into v_institution from public.institutions where lower(slug)='sina' limit 1;
  select coalesce(nullif(p.display_name,''),nullif(au.raw_user_meta_data->>'display_name',''),split_part(coalesce(au.email,''),'@',1))
  into display_name
  from auth.users au left join public.profiles p on p.user_id=au.id where au.id=_user_id;

  if v_institution is not null then
    insert into public.institution_memberships(institution_id,user_id,role,status)
    values(v_institution,_user_id,'student','active')
    on conflict(institution_id,user_id,role) do update set status='active';
  end if;

  insert into public.students(user_id,full_name,enrollment,classroom,teacher_id,institution_id)
  values(_user_id,coalesce(display_name,'Aluno'),'','',null,v_institution)
  on conflict(user_id) where user_id is not null do nothing;
  return true;
end;
$$;

create or replace function public.admin_review_role_request(_request_id uuid,_decision text,_approved_role text,_note text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare req public.account_role_requests; inst uuid; title_text text; body_text text;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso reservado a administradores.'; end if;
  if _decision not in ('approved','rejected') then raise exception 'Decisão inválida.'; end if;

  select * into req from public.account_role_requests where id=_request_id for update;
  if req.id is null then return false; end if;
  if req.status<>'pending' then raise exception 'Esta solicitação já foi processada.'; end if;

  if _decision='rejected' then
    update public.account_role_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(_note),''),updated_at=now() where id=_request_id;
    update public.profiles set status='pending',updated_at=now() where user_id=req.user_id;
    title_text:='Cadastro aguardando nova análise';
    body_text:=coalesce(nullif(trim(_note),''),'Sua solicitação de acesso não foi aprovada. Você pode enviar uma nova solicitação.');
    insert into public.notifications(user_id,type,title,body,link,metadata)
    values(req.user_id,'account_review',title_text,body_text,'/auth',jsonb_build_object('request_id',req.id,'decision','rejected'));
    return true;
  end if;

  if _approved_role not in ('student','teacher') then raise exception 'Selecione uma função válida para aprovar.'; end if;

  select id into inst from public.institutions where lower(slug)='sina' limit 1;
  delete from public.user_roles where user_id=req.user_id and role in ('student','teacher');
  insert into public.user_roles(user_id,role) values(req.user_id,_approved_role::public.app_role);

  if inst is not null then
    delete from public.institution_memberships where user_id=req.user_id and role in ('student','teacher');
    insert into public.institution_memberships(institution_id,user_id,role,status)
    values(inst,req.user_id,_approved_role::public.app_role,'active');
  end if;

  update public.profiles set status='active',updated_at=now() where user_id=req.user_id;
  if _approved_role='student' then perform public.ensure_student_profile_for_user(req.user_id); end if;

  update public.account_role_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(trim(_note),''),updated_at=now()
  where id=_request_id;

  title_text:='Cadastro aprovado';
  body_text:=case when _approved_role='teacher' then 'Seu acesso de professor foi aprovado. Agora você já pode entrar na área do professor.' else 'Seu acesso de aluno foi aprovado. Agora você já pode entrar na área do aluno.' end;
  insert into public.notifications(user_id,type,title,body,link,metadata)
  values(req.user_id,'account_review',title_text,body_text,case when _approved_role='teacher' then '/professor' else '/aluno' end,jsonb_build_object('request_id',req.id,'decision','approved','role',_approved_role));
  return true;
end;
$$;

revoke all on function public.ensure_account_onboarding(text) from public,anon;
revoke all on function public.account_get_onboarding_state() from public,anon;
revoke all on function public.account_resubmit_role_request(text) from public,anon;
revoke all on function public.admin_list_role_requests() from public,anon;
revoke all on function public.admin_review_role_request(uuid,text,text,text) from public,anon;
revoke all on function public.ensure_student_profile_for_user(uuid) from public,anon,authenticated;

grant execute on function public.ensure_account_onboarding(text) to authenticated;
grant execute on function public.account_get_onboarding_state() to authenticated;
grant execute on function public.account_resubmit_role_request(text) to authenticated;
grant execute on function public.admin_list_role_requests() to authenticated;
grant execute on function public.admin_review_role_request(uuid,text,text,text) to authenticated;

-- Final onboarding state handling: preserve rejected requests until the user explicitly resubmits.
create or replace function public.ensure_account_onboarding(_requested_role text default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid:=auth.uid();
  requested text;
  display_name text;
  current_status text;
  current_role text;
  request_row public.account_role_requests;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;

  select coalesce(nullif(_requested_role,''),nullif(au.raw_user_meta_data->>'requested_role',''),'student'),
         coalesce(nullif(p.display_name,''),nullif(au.raw_user_meta_data->>'display_name',''),split_part(coalesce(au.email,''),'@',1)),
         p.status
  into requested,display_name,current_status
  from auth.users au left join public.profiles p on p.user_id=au.id where au.id=uid;

  if requested not in ('student','teacher') then requested:='student'; end if;

  select r.role::text into current_role
  from public.user_roles r where r.user_id=uid and r.role in ('admin','teacher','student')
  order by case when r.role='admin' then 0 when r.role='teacher' then 1 else 2 end limit 1;

  if current_role is not null then
    insert into public.profiles(user_id,display_name,status)
    values(uid,display_name,'active')
    on conflict(user_id) do update set
      display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
      status=case when public.profiles.status='pending' then 'active' else public.profiles.status end,
      updated_at=now();
    current_status:=coalesce((select p.status from public.profiles p where p.user_id=uid),'active');
  else
    insert into public.profiles(user_id,display_name,status)
    values(uid,display_name,'pending')
    on conflict(user_id) do update set
      display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
      status='pending',updated_at=now();
    current_status:='pending';

    select * into request_row
    from public.account_role_requests
    where user_id=uid
    order by created_at desc
    limit 1;

    if request_row.id is null then
      insert into public.account_role_requests(user_id,requested_role,status)
      values(uid,requested::public.app_role,'pending')
      returning * into request_row;
    elsif request_row.status='pending' and _requested_role is not null and request_row.requested_role::text<>requested then
      update public.account_role_requests
      set requested_role=requested::public.app_role,updated_at=now()
      where id=request_row.id returning * into request_row;
    elsif request_row.status in ('rejected','cancelled') and _requested_role is not null then
      insert into public.account_role_requests(user_id,requested_role,status)
      values(uid,requested::public.app_role,'pending')
      returning * into request_row;
    end if;
  end if;

  return jsonb_build_object(
    'status',current_status,
    'role',current_role,
    'requested_role',request_row.requested_role::text,
    'request_status',request_row.status,
    'request_id',request_row.id,
    'review_note',request_row.review_note
  );
end;
$$;

revoke all on function public.ensure_account_onboarding(text) from public,anon;
grant execute on function public.ensure_account_onboarding(text) to authenticated;
