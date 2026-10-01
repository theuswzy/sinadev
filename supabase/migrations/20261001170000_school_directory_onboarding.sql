-- SINA: school directory and institution-aware onboarding
-- The directory is a catalog of real schools. It is intentionally separate from
-- public.institutions: a school only becomes an active SINA institution after approval.

create table if not exists public.school_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  municipality text not null default 'Salvador',
  state text not null default 'BA',
  network_type text not null check (network_type in ('municipal','estadual','federal')),
  administrative_type text not null default 'publica' check (administrative_type in ('publica','privada')),
  inep_code text,
  source text not null default 'official',
  source_year integer,
  status text not null default 'active' check (status in ('active','inactive')),
  institution_id uuid references public.institutions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_directory_inep_key
  on public.school_directory(inep_code)
  where inep_code is not null;

create unique index if not exists school_directory_name_network_key
  on public.school_directory(normalized_name, municipality, state, network_type);

create index if not exists school_directory_search_key
  on public.school_directory(municipality, state, network_type, status);

alter table public.school_directory enable row level security;

drop policy if exists "Anyone can search active school directory" on public.school_directory;
create policy "Anyone can search active school directory"
on public.school_directory for select
using (status = 'active');

-- The institution that adopts a directory school can be linked to the catalog.
alter table public.account_role_requests
  add column if not exists institution_id uuid references public.institutions(id) on delete set null,
  add column if not exists school_directory_id uuid references public.school_directory(id) on delete set null;

create index if not exists account_role_requests_institution_status_key
  on public.account_role_requests(institution_id, status, created_at desc);

create index if not exists account_role_requests_school_directory_key
  on public.account_role_requests(school_directory_id);

-- Public search used by the registration screen. It exposes only school directory
-- information, never user or institution membership data.
drop function if exists public.school_directory_search(text, text, text);
create or replace function public.school_directory_search(
  _search text default '',
  _network_type text default null,
  _municipality text default 'Salvador'
)
returns table (
  id uuid,
  name text,
  municipality text,
  state text,
  network_type text,
  inep_code text,
  institution_id uuid
)
language sql
stable
security invoker
set search_path to ''
as $$
  select d.id, d.name, d.municipality, d.state, d.network_type, d.inep_code, d.institution_id
  from public.school_directory d
  where d.status = 'active'
    and lower(d.municipality) = lower(coalesce(nullif(trim(_municipality), ''), 'Salvador'))
    and (_network_type is null or d.network_type = _network_type)
    and (
      nullif(trim(_search), '') is null
      or d.normalized_name like '%' || lower(trim(_search)) || '%'
      or lower(d.name) like '%' || lower(trim(_search)) || '%'
    )
  order by d.name
  limit 30;
$$;

revoke all on function public.school_directory_search(text,text,text) from public, anon;
grant execute on function public.school_directory_search(text,text,text) to anon, authenticated;

-- Institution-aware onboarding. The old RPC remains available for existing users,
-- while new registrations can explicitly bind their request to a real school.
create or replace function public.ensure_account_onboarding_v2(
  _requested_role text,
  _school_directory_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  requested text := nullif(trim(_requested_role), '');
  display_name text;
  current_status text;
  current_role text;
  request_row public.account_role_requests;
  school public.school_directory;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if requested not in ('student','teacher') then
    raise exception 'Escolha uma função válida: aluno ou professor.';
  end if;

  select * into school
  from public.school_directory
  where id = _school_directory_id and status = 'active'
  limit 1;

  if school.id is null then
    raise exception 'Selecione uma escola válida para continuar.';
  end if;

  select coalesce(nullif(p.display_name,''), nullif(au.raw_user_meta_data->>'display_name',''), split_part(coalesce(au.email,''),'@',1)),
         p.status
    into display_name, current_status
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  where au.id = uid;

  select r.role::text into current_role
  from public.user_roles r
  where r.user_id = uid
    and r.role in ('admin','teacher','student')
  order by case when r.role='admin' then 0 when r.role='teacher' then 1 else 2 end
  limit 1;

  if current_role = 'admin' then
    return jsonb_build_object(
      'status', coalesce(current_status, 'active'),
      'role', current_role,
      'requested_role', current_role,
      'request_status', 'approved',
      'request_id', null,
      'review_note', null
    );
  end if;

  if current_role is not null then
    if exists (
      select 1
      from public.institution_memberships m
      where m.user_id = uid
        and m.role = current_role::public.app_role
        and m.status = 'active'
    ) then
      return jsonb_build_object(
        'status', coalesce(current_status, 'active'),
        'role', current_role,
        'requested_role', current_role,
        'request_status', 'approved',
        'request_id', null,
        'review_note', null
      );
    end if;
  end if;

  insert into public.profiles(user_id, display_name, status)
  values (uid, coalesce(display_name, 'Usuário'), 'pending')
  on conflict (user_id) do update set
    display_name = case when public.profiles.display_name = '' then excluded.display_name else public.profiles.display_name end,
    status = 'pending',
    updated_at = now();

  current_status := 'pending';

  select * into request_row
  from public.account_role_requests
  where user_id = uid
    and status = 'pending'
  order by created_at desc
  limit 1;

  if request_row.id is null then
    insert into public.account_role_requests(
      user_id, requested_role, status, school_directory_id
    )
    values (
      uid, requested::public.app_role, 'pending', school.id
    )
    returning * into request_row;
  else
    update public.account_role_requests
    set requested_role = requested::public.app_role,
        school_directory_id = school.id,
        updated_at = now()
    where id = request_row.id
    returning * into request_row;
  end if;

  return jsonb_build_object(
    'status', current_status,
    'role', null,
    'requested_role', request_row.requested_role::text,
    'request_status', request_row.status,
    'request_id', request_row.id,
    'review_note', request_row.review_note
  );
end;
$$;

revoke all on function public.ensure_account_onboarding_v2(text,uuid) from public, anon;
grant execute on function public.ensure_account_onboarding_v2(text,uuid) to authenticated;

-- Link directory schools to institutions without exposing the whole catalog as active tenants.
alter table public.institutions
  add column if not exists school_directory_id uuid references public.school_directory(id) on delete set null;

create unique index if not exists institutions_school_directory_key
  on public.institutions(school_directory_id)
  where school_directory_id is not null;

-- Admin approval now resolves the requested real school into an active SINA institution.
create or replace function public.admin_review_role_request_v2(
  _request_id uuid,
  _decision text,
  _approved_role text,
  _note text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  req public.account_role_requests;
  school public.school_directory;
  inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if _decision not in ('approved','rejected') then
    raise exception 'Decisão inválida.';
  end if;

  select * into req
  from public.account_role_requests
  where id = _request_id
  for update;

  if req.id is null then return false; end if;
  if req.status <> 'pending' then raise exception 'Esta solicitação já foi processada.'; end if;

  if _decision = 'rejected' then
    update public.account_role_requests
    set status='rejected',
        reviewed_by=auth.uid(),
        reviewed_at=now(),
        review_note=nullif(trim(_note),''),
        updated_at=now()
    where id=_request_id;

    update public.profiles
    set status='pending', updated_at=now()
    where user_id=req.user_id;

    return true;
  end if;

  if _approved_role not in ('student','teacher') then
    raise exception 'Selecione uma função válida para aprovar.';
  end if;

  select * into school
  from public.school_directory
  where id = req.school_directory_id
    and status = 'active';

  if school.id is null then
    raise exception 'A escola selecionada não está mais disponível no catálogo.';
  end if;

  select id into inst
  from public.institutions
  where school_directory_id = school.id
  limit 1;

  if inst is null then
    insert into public.institutions(name, slug, status, school_directory_id)
    values (
      school.name,
      lower(regexp_replace(regexp_replace(school.name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')),
      'active',
      school.id
    )
    returning id into inst;
  end if;

  delete from public.user_roles
  where user_id=req.user_id
    and role in ('student','teacher');

  insert into public.user_roles(user_id,role)
  values(req.user_id,_approved_role::public.app_role);

  delete from public.institution_memberships
  where user_id=req.user_id
    and role in ('student','teacher');

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,req.user_id,_approved_role::public.app_role,'active');

  update public.account_role_requests
  set institution_id=inst,
      status='approved',
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      review_note=nullif(trim(_note),''),
      updated_at=now()
  where id=_request_id;

  update public.profiles
  set status='active', updated_at=now()
  where user_id=req.user_id;

  update public.school_directory
  set institution_id=inst, updated_at=now()
  where id=school.id;

  if _approved_role='student' then
    perform public.ensure_student_profile_for_user(req.user_id, inst);
  end if;

  return true;
end;
$$;

revoke all on function public.admin_review_role_request_v2(uuid,text,text,text) from public, anon;
grant execute on function public.admin_review_role_request_v2(uuid,text,text,text) to authenticated;

-- A two-argument student profile helper keeps the existing one intact.
create or replace function public.ensure_student_profile_for_user(
  _user_id uuid,
  _institution_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare display_name text;
begin
  if _institution_id is null then
    raise exception 'Instituição obrigatória para criar o perfil do aluno.';
  end if;

  select coalesce(
    nullif(p.display_name,''),
    nullif(au.raw_user_meta_data->>'display_name',''),
    split_part(coalesce(au.email,''),'@',1)
  )
  into display_name
  from auth.users au
  left join public.profiles p on p.user_id=au.id
  where au.id=_user_id;

  insert into public.students(
    user_id, full_name, enrollment, classroom, teacher_id, institution_id
  )
  values(
    _user_id, coalesce(display_name,'Aluno'), '', '', null, _institution_id
  )
  on conflict (user_id) where user_id is not null do update
    set institution_id = coalesce(public.students.institution_id, excluded.institution_id),
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.ensure_student_profile_for_user(uuid,uuid) from public, anon;
revoke all on function public.ensure_student_profile_for_user(uuid,uuid) from public, anon, authenticated;

create or replace function public.admin_list_role_requests_v2()
returns table(
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  requested_role text,
  status text,
  review_note text,
  created_at timestamptz,
  reviewed_at timestamptz,
  school_directory_id uuid,
  school_name text,
  school_network_type text
)
language sql
stable
security definer
set search_path to ''
as $
  select
    rr.id,
    rr.user_id,
    au.email::text,
    coalesce(p.display_name,''),
    rr.requested_role::text,
    rr.status,
    rr.review_note,
    rr.created_at,
    rr.reviewed_at,
    rr.school_directory_id,
    d.name,
    d.network_type
  from public.account_role_requests rr
  join auth.users au on au.id=rr.user_id
  left join public.profiles p on p.user_id=rr.user_id
  left join public.school_directory d on d.id=rr.school_directory_id
  where public.has_role(auth.uid(),'admin'::public.app_role)
  order by case when rr.status='pending' then 0 else 1 end, rr.created_at desc;
$;

revoke all on function public.admin_list_role_requests_v2() from public, anon;
grant execute on function public.admin_list_role_requests_v2() to authenticated;

-- Initial verified catalog entries. More rows can be imported without changing the schema.
insert into public.school_directory
  (name, normalized_name, municipality, state, network_type, administrative_type, source, source_year)
values
  ('Colégio Estadual Professor Rômulo Almeida', 'colegio estadual professor romulo almeida', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Clériston Andrade', 'colegio estadual cleriston andrade', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Cosme de Farias', 'colegio estadual cosme de farias', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual da Bahia Central', 'colegio estadual da bahia central', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Monteiro Lobato', 'colegio estadual monteiro lobato', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Nelson Barros', 'colegio estadual nelson barros', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Nelson Mandela', 'colegio estadual nelson mandela', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Professor José Barreto de Araújo Bastos', 'colegio estadual professor jose barreto de araujo bastos', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Polivalente de Amaralina', 'colegio estadual polivalente de amaralina', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Polivalente San Diego', 'colegio estadual polivalente san diego', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Escola Estadual Presciliano Silva', 'escola estadual presciliano silva', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Princesa Izabel', 'colegio estadual princesa izabel', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Escola Professor Roberto Santos', 'escola professor roberto santos', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Escola Estadual Pierre Verger', 'escola estadual pierre verger', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Santa Rita de Cássia', 'colegio estadual santa rita de cassia', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Escola Estadual Teodoro Sampaio', 'escola estadual teodoro sampaio', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Escola Visconde de Itaparica', 'escola visconde de itaparica', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Alberto Santos Dumont', 'colegio estadual alberto santos dumont', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Brigadeiro Eduardo Gomes', 'colegio estadual brigadeiro eduardo gomes', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Colégio Estadual Cesare Casali', 'colegio estadual cesare casali', 'Salvador', 'BA', 'estadual', 'publica', 'SEC Bahia', 2026),
  ('Escola Municipal São José', 'escola municipal sao jose', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal União, Caridade e Abrigo', 'escola municipal uniao caridade e abrigo', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal Ana Nery', 'escola municipal ana nery', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal Paulo Mendes de Aguiar', 'escola municipal paulo mendes de aguiar', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal do Curralinho', 'escola municipal do curralinho', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal Maria Antonieta Alfarano', 'escola municipal maria antonieta alfarano', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal Elysio Athayde', 'escola municipal elysio athayde', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal de São Marcos', 'escola municipal de sao marcos', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal Clériston Andrade', 'escola municipal cleriston andrade', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026),
  ('Escola Municipal General Labatut', 'escola municipal general labatut', 'Salvador', 'BA', 'municipal', 'publica', 'Prefeitura de Salvador', 2026)
on conflict (normalized_name, municipality, state, network_type) do update
set name=excluded.name, source=excluded.source, source_year=excluded.source_year, status='active', updated_at=now();

-- Fix public search visibility and update timestamp helpers.
revoke all on public.school_directory from anon, authenticated;
grant select on public.school_directory to anon, authenticated;
