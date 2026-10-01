-- SINA platform foundation: multi-institution structure, secure roster, statuses,
-- notifications and transactional bulk grade entry.

create schema if not exists sina_private;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists institutions_slug_lower_key
  on public.institutions (lower(slug));

create table if not exists public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, user_id, role)
);

create index if not exists institution_memberships_user_key
  on public.institution_memberships (user_id, institution_id);

create index if not exists institution_memberships_institution_key
  on public.institution_memberships (institution_id, role, status);

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists classrooms_institution_name_key
  on public.classrooms (institution_id, lower(name));

create index if not exists classrooms_institution_status_key
  on public.classrooms (institution_id, status);

create table if not exists public.classroom_teachers (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);

create index if not exists classroom_teachers_user_key
  on public.classroom_teachers (user_id, classroom_id);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subjects_institution_name_key
  on public.subjects (institution_id, lower(name));

create table if not exists public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  starts_at date,
  ends_at date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academic_terms_current_key
  on public.academic_terms (institution_id)
  where is_current;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text not null default '',
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_key
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_key
  on public.notifications (user_id)
  where read_at is null;

alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active','pending','suspended'));

alter table public.students
  add column if not exists institution_id uuid references public.institutions(id) on delete restrict,
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;

alter table public.announcements
  add column if not exists institution_id uuid references public.institutions(id) on delete restrict,
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;

alter table public.tasks
  add column if not exists institution_id uuid references public.institutions(id) on delete restrict,
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;

alter table public.grades
  add column if not exists institution_id uuid references public.institutions(id) on delete restrict,
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists term_id uuid references public.academic_terms(id) on delete set null;

insert into public.institutions (name, slug, status)
values ('SINA', 'sina', 'active')
on conflict ((lower(slug))) do nothing;

do $$
declare
  v_institution uuid;
begin
  select id into v_institution from public.institutions where lower(slug) = 'sina' limit 1;

  update public.profiles
     set status = coalesce(nullif(status, ''), 'active')
   where status is null or status = '';

  insert into public.institution_memberships (institution_id, user_id, role, status)
  select v_institution, ur.user_id, ur.role, 'active'
  from public.user_roles ur
  on conflict (institution_id, user_id, role) do nothing;

  update public.students
     set institution_id = coalesce(institution_id, v_institution)
   where institution_id is null;

  insert into public.classrooms (institution_id, name, status)
  select distinct v_institution, trim(s.classroom), 'active'
  from public.students s
  where nullif(trim(s.classroom), '') is not null
  on conflict ((institution_id), (lower(name))) do nothing;

  update public.students s
     set classroom_id = c.id
    from public.classrooms c
   where c.institution_id = s.institution_id
     and lower(c.name) = lower(trim(s.classroom))
     and nullif(trim(s.classroom), '') is not null;

  insert into public.classroom_teachers (classroom_id, user_id)
  select distinct s.classroom_id, s.teacher_id
  from public.students s
  where s.classroom_id is not null
    and s.teacher_id is not null
  on conflict do nothing;

  update public.announcements a
   set institution_id = coalesce(
         a.institution_id,
         (select im.institution_id from public.institution_memberships im
          where im.user_id = a.teacher_id and im.role = 'teacher' and im.status = 'active' limit 1)
       ),
       classroom_id = coalesce(
         a.classroom_id,
         (select c.id from public.classrooms c
          where c.institution_id = (
            select im.institution_id from public.institution_memberships im
            where im.user_id = a.teacher_id and im.role = 'teacher' and im.status = 'active' limit 1
          )
          and lower(c.name) = lower(trim(a.classroom))
          limit 1)
       )
 where a.institution_id is null or a.classroom_id is null;

  update public.tasks t
   set institution_id = coalesce(
         t.institution_id,
         (select im.institution_id from public.institution_memberships im
          where im.user_id = t.teacher_id and im.role = 'teacher' and im.status = 'active' limit 1)
       ),
       classroom_id = coalesce(
         t.classroom_id,
         (select c.id from public.classrooms c
          where c.institution_id = (
            select im.institution_id from public.institution_memberships im
            where im.user_id = t.teacher_id and im.role = 'teacher' and im.status = 'active' limit 1
          )
          and lower(c.name) = lower(trim(t.classroom))
          limit 1)
       )
 where t.institution_id is null or t.classroom_id is null;

  insert into public.subjects (institution_id, name, status)
  select distinct s.institution_id, trim(g.subject), 'active'
  from public.grades g
  join public.students s on s.id = g.student_id
  where s.institution_id is not null
    and nullif(trim(g.subject), '') is not null
  on conflict ((institution_id), (lower(name))) do nothing;

  update public.grades g
     set institution_id = (
           select s.institution_id from public.students s
           where s.id = g.student_id
         ),
         subject_id = coalesce(
           g.subject_id,
           (
             select sub.id
             from public.subjects sub
             where sub.institution_id = (
               select s2.institution_id from public.students s2 where s2.id = g.student_id
             )
               and lower(sub.name) = lower(trim(g.subject))
             limit 1
           )
         )
   where g.institution_id is null or g.subject_id is null;
end
$$;

create index if not exists students_institution_classroom_key
  on public.students (institution_id, classroom_id);

create index if not exists students_institution_teacher_key
  on public.students (institution_id, teacher_id);

create index if not exists announcements_institution_created_key
  on public.announcements (institution_id, created_at desc);

create index if not exists tasks_institution_due_key
  on public.tasks (institution_id, due_at, created_at desc);

create index if not exists grades_institution_student_key
  on public.grades (institution_id, student_id);

alter table public.institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.academic_terms enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Members can read their institutions" on public.institutions;
create policy "Members can read their institutions"
on public.institutions for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.institution_id = institutions.id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can read institution memberships" on public.institution_memberships;
create policy "Members can read institution memberships"
on public.institution_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.institution_memberships own
    where own.institution_id = institution_memberships.institution_id
      and own.user_id = (select auth.uid())
      and own.role = 'admin'
      and own.status = 'active'
  )
);

drop policy if exists "Members can read classrooms" on public.classrooms;
create policy "Members can read classrooms"
on public.classrooms for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.institution_id = classrooms.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can read classroom teachers" on public.classroom_teachers;
create policy "Members can read classroom teachers"
on public.classroom_teachers for select to authenticated
using (
  exists (
    select 1 from public.classrooms c
    join public.institution_memberships m on m.institution_id = c.institution_id
    where c.id = classroom_teachers.classroom_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can read subjects" on public.subjects;
create policy "Members can read subjects"
on public.subjects for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.institution_id = subjects.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Members can read academic terms" on public.academic_terms;
create policy "Members can read academic terms"
on public.academic_terms for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.institution_id = academic_terms.institution_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id and r.role = _role
  )
  and coalesce((
    select p.status from public.profiles p where p.user_id = _user_id limit 1
  ), 'active') = 'active'
  and exists (
    select 1
    from public.institution_memberships m
    where m.user_id = _user_id
      and m.role = _role
      and m.status = 'active'
  );
$function$;

create or replace function public.ensure_student_profile()
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  existing_role public.app_role;
  display_name text;
  v_institution uuid;
begin
  if uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select ur.role into existing_role
  from public.user_roles ur
  where ur.user_id = uid
    and ur.role in ('admin'::public.app_role, 'teacher'::public.app_role)
  order by case when ur.role = 'admin'::public.app_role then 0 else 1 end
  limit 1;

  if existing_role is not null then
    return false;
  end if;

  select id into v_institution
  from public.institutions
  where lower(slug) = 'sina'
  limit 1;

  if v_institution is not null then
    insert into public.institution_memberships(institution_id, user_id, role, status)
    values (v_institution, uid, 'student'::public.app_role, 'active')
    on conflict (institution_id, user_id, role) do update set status = 'active';
  end if;

  select coalesce(nullif(p.display_name, ''), nullif(au.raw_user_meta_data->>'display_name', ''), split_part(au.email, '@', 1))
    into display_name
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  where au.id = uid;

  insert into public.students (user_id, full_name, enrollment, classroom, teacher_id, institution_id)
  values (uid, coalesce(display_name, 'Aluno'), '', '', null, v_institution)
  on conflict (user_id) where user_id is not null do nothing;

  return true;
end;
$function$;

create or replace function sina_private.set_academic_role(_user_id uuid, _role text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_institution uuid;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;
  if _role not in ('student', 'teacher') or _role is null then
    raise exception 'Função acadêmica inválida.';
  end if;
  if not exists (select 1 from auth.users where id = _user_id) then return false; end if;
  if public.has_role(_user_id, 'admin'::public.app_role) then
    raise exception 'A função acadêmica de um administrador não pode ser alterada nesta tela.';
  end if;

  select id into v_institution from public.institutions where lower(slug) = 'sina' limit 1;
  delete from public.user_roles where user_id = _user_id and role in ('student'::public.app_role, 'teacher'::public.app_role);
  insert into public.user_roles(user_id, role) values (_user_id, _role::public.app_role);

  if v_institution is not null then
    delete from public.institution_memberships
     where user_id = _user_id
       and role in ('student'::public.app_role, 'teacher'::public.app_role);

    insert into public.institution_memberships(institution_id, user_id, role, status)
    values (v_institution, _user_id, _role::public.app_role, coalesce(
      (select p.status from public.profiles p where p.user_id = _user_id limit 1), 'active'
    ));
  end if;

  return true;
end;
$function$;

create or replace function sina_private.current_institution(_role public.app_role default null)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select m.institution_id
  from public.institution_memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and (_role is null or m.role = _role)
  order by case when m.role = 'admin' then 0 when m.role = 'teacher' then 1 else 2 end
  limit 1;
$$;

create or replace function sina_private.create_classroom_if_needed(_institution_id uuid, _name text, _teacher_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if _institution_id is null or nullif(trim(_name), '') is null then
    raise exception 'Instituição e turma são obrigatórias.';
  end if;

  insert into public.classrooms (institution_id, name, status)
  values (_institution_id, trim(_name), 'active')
  on conflict ((institution_id), (lower(name))) do update set updated_at = now()
  returning id into v_id;

  insert into public.classroom_teachers (classroom_id, user_id)
  values (v_id, _teacher_id)
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function sina_private.create_classroom_notifications(
  _teacher_id uuid,
  _classroom_id uuid,
  _type text,
  _title text,
  _body text,
  _link text default null
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications(user_id, type, title, body, link, metadata)
  select s.user_id, _type, _title, _body, _link,
         jsonb_build_object('classroom_id', _classroom_id)
  from public.students s
  where s.classroom_id = _classroom_id
    and s.user_id is not null
    and s.user_id <> _teacher_id;
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.teacher_list_roster()
returns table (
  id uuid,
  full_name text,
  enrollment text,
  classroom text,
  classroom_id uuid,
  attendance numeric,
  teacher_id uuid
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_institution uuid;
begin
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  if v_institution is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  return query
  select s.id, s.full_name, s.enrollment, s.classroom, s.classroom_id, s.attendance, s.teacher_id
  from public.students s
  where s.institution_id = v_institution
    and (s.teacher_id = auth.uid() or s.teacher_id is null)
  order by case when s.teacher_id is null then 0 else 1 end, lower(s.full_name);
end;
$$;

create or replace function public.teacher_link_roster_student(
  _student_id uuid,
  _enrollment text,
  _classroom text
)
returns table (
  id uuid,
  full_name text,
  enrollment text,
  classroom text,
  classroom_id uuid,
  attendance numeric,
  teacher_id uuid
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_institution uuid;
  v_classroom uuid;
begin
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  if v_institution is null then
    raise exception 'Professor sem instituição ativa.';
  end if;
  if nullif(trim(_enrollment), '') is null or nullif(trim(_classroom), '') is null then
    raise exception 'Matrícula e turma são obrigatórias.';
  end if;

  v_classroom := sina_private.create_classroom_if_needed(v_institution, _classroom, auth.uid());

  update public.students
     set institution_id = v_institution,
         classroom_id = v_classroom,
         teacher_id = auth.uid(),
         enrollment = trim(_enrollment),
         classroom = trim(_classroom),
         updated_at = now()
   where id = _student_id
     and institution_id = v_institution
     and (teacher_id is null or teacher_id = auth.uid());

  if not found then
    raise exception 'Aluno não encontrado ou já vinculado a outro professor.';
  end if;

  return query
  select s.id, s.full_name, s.enrollment, s.classroom, s.classroom_id, s.attendance, s.teacher_id
  from public.students s
  where s.id = _student_id;
end;
$$;

create or replace function public.teacher_unlink_roster_student(_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1
    from public.institution_memberships m
    where m.user_id = auth.uid()
      and m.role = 'teacher'
      and m.status = 'active'
  ) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  update public.students
     set teacher_id = null,
         classroom_id = null,
         enrollment = '',
         classroom = '',
         updated_at = now()
   where id = _student_id
     and teacher_id = auth.uid();

  return found;
end;
$$;

create or replace function public.teacher_bulk_upsert_grades(
  _classroom_id uuid,
  _subject text,
  _period integer,
  _rows jsonb
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_institution uuid;
  v_count integer := 0;
  item jsonb;
  v_student uuid;
  v_score numeric;
  v_absences integer;
begin
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  if v_institution is null then raise exception 'Professor sem instituição ativa.'; end if;
  if _classroom_id is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject), '') is null then raise exception 'Informe a disciplina.'; end if;
  if _period < 1 or _period > 4 then raise exception 'Período inválido.'; end if;
  if jsonb_typeof(_rows) <> 'array' or jsonb_array_length(_rows) = 0 then raise exception 'Nenhuma nota foi informada.'; end if;

  if not exists (
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id = ct.classroom_id
    where ct.classroom_id = _classroom_id
      and ct.user_id = auth.uid()
      and c.institution_id = v_institution
      and c.status = 'active'
  ) then
    raise exception 'A turma não pertence a este professor.';
  end if;

  for item in select value from jsonb_array_elements(_rows)
  loop
    v_student := nullif(item->>'student_id','')::uuid;
    v_score := nullif(item->>'score','')::numeric;
    if v_student is null or v_score is null or v_score < 0 or v_score > 10 then
      raise exception 'Existe uma nota inválida no lote.';
    end if;

    select coalesce((item->>'absences')::integer, g.absences, 0)
      into v_absences
      from (select 1) x
      left join public.grades g
        on g.student_id = v_student
       and lower(trim(g.subject)) = lower(trim(_subject))
       and g.period = _period;

    if not exists (
      select 1 from public.students s
      where s.id = v_student
        and s.teacher_id = auth.uid()
        and s.institution_id = v_institution
        and s.classroom_id = _classroom_id
    ) then
      raise exception 'Um dos alunos não pertence a esta turma.';
    end if;

    if v_absences < 0 then raise exception 'Quantidade de faltas inválida.'; end if;

    insert into public.grades (student_id, subject, period, score, absences, institution_id)
    values (v_student, trim(_subject), _period, v_score, v_absences, v_institution)
    on conflict (student_id, subject, period)
    do update set score = excluded.score,
                  absences = excluded.absences,
                  institution_id = excluded.institution_id,
                  updated_at = now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.student_list_notifications(
  _unread_only boolean default false,
  _limit integer default 30
)
returns setof public.notifications
language sql
security invoker
set search_path to ''
as $$
  select n.*
  from public.notifications n
  where n.user_id = auth.uid()
    and (not _unread_only or n.read_at is null)
  order by n.created_at desc
  limit greatest(1, least(coalesce(_limit, 30), 100));
$$;

create or replace function public.student_mark_notification_read(_id uuid)
returns boolean
language sql
security invoker
set search_path to ''
as $$
  update public.notifications
     set read_at = coalesce(read_at, now())
   where id = _id
     and user_id = auth.uid()
  returning true;
$$;

create or replace function sina_private.set_account_status(_user_id uuid, _status text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  if _status not in ('active','pending','suspended') then
    raise exception 'Status de conta inválido.';
  end if;

  if _user_id = auth.uid() then
    raise exception 'A própria conta administrativa não pode ser suspensa.';
  end if;

  if public.has_role(_user_id, 'admin'::public.app_role) then
    raise exception 'Contas administrativas não podem ser suspensas nesta tela.';
  end if;

  update public.profiles
     set status = _status,
         updated_at = now()
   where user_id = _user_id;

  update public.institution_memberships
     set status = case when _status = 'suspended' then 'suspended' else 'active' end,
         updated_at = now()
   where user_id = _user_id;

  return found;
end;
$$;

create or replace function public.admin_set_account_status(_user_id uuid, _status text)
returns boolean
language sql
security definer
set search_path to ''
as $$
  select sina_private.set_account_status(_user_id, _status)
$$;

drop function if exists public.admin_list_accounts();
drop function if exists sina_private.list_accounts();

create or replace function sina_private.list_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  academic_role text,
  is_administrator boolean,
  account_status text
)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;

  return query
  select u.id,
         u.email::text,
         coalesce(p.display_name, '')::text,
         case when exists (
           select 1 from public.user_roles r where r.user_id = u.id and r.role = 'teacher'::public.app_role
         ) then 'teacher' else 'student' end::text,
         exists (
           select 1 from public.user_roles r where r.user_id = u.id and r.role = 'admin'::public.app_role
         ),
         coalesce(p.status, 'active')
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  order by coalesce(nullif(p.display_name, ''), u.email), u.email;
end;
$$;

create or replace function public.admin_list_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  academic_role text,
  is_administrator boolean,
  account_status text
)
language sql
stable
security definer
set search_path to ''
as $$
  select * from sina_private.list_accounts()
$$;

create or replace function public.teacher_create_announcement(
  _classroom text,
  _title text,
  _content text,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $$
declare
  result_row public.announcements;
  v_institution uuid;
  v_classroom uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  if v_institution is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom), '') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_title), '') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content), '') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  select id into v_classroom
  from public.classrooms
  where id in (select classroom_id from public.classroom_teachers where user_id = auth.uid())
    and institution_id = v_institution
    and lower(name) = lower(trim(_classroom))
    and status = 'active'
  limit 1;

  if v_classroom is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  insert into public.announcements(
    teacher_id, classroom, title, content, attachment_path, attachment_name,
    attachment_size, attachment_type, institution_id, classroom_id
  )
  values(
    auth.uid(), trim(_classroom), trim(_title), trim(_content),
    nullif(trim(_attachment_path), ''), nullif(trim(_attachment_name), ''),
    _attachment_size, nullif(trim(_attachment_type), ''), v_institution, v_classroom
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(), v_classroom, 'announcement',
    trim(_title), trim(_content), '/aluno#tarefas'
  );

  return result_row;
end;
$$;

create or replace function public.teacher_create_task(
  _classroom text,
  _subject text,
  _title text,
  _description text,
  _due_at timestamptz,
  _attachment_path text default null,
  _attachment_name text default null,
  _attachment_size bigint default null,
  _attachment_type text default null
)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $$
declare
  result_row public.tasks;
  v_institution uuid;
  v_classroom uuid;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  v_institution := sina_private.current_institution('teacher'::public.app_role);
  if v_institution is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom), '') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject), '') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title), '') is null then raise exception 'Informe o título da atividade.'; end if;

  select id into v_classroom
  from public.classrooms
  where id in (select classroom_id from public.classroom_teachers where user_id = auth.uid())
    and institution_id = v_institution
    and lower(name) = lower(trim(_classroom))
    and status = 'active'
  limit 1;

  if v_classroom is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  insert into public.tasks(
    teacher_id, classroom, subject, title, description, due_at,
    attachment_path, attachment_name, attachment_size, attachment_type,
    institution_id, classroom_id
  )
  values(
    auth.uid(), trim(_classroom), trim(_subject), trim(_title),
    coalesce(trim(_description), ''), _due_at,
    nullif(trim(_attachment_path), ''), nullif(trim(_attachment_name), ''),
    _attachment_size, nullif(trim(_attachment_type), ''), v_institution, v_classroom
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(), v_classroom, 'task',
    trim(_title),
    case when _due_at is null then trim(coalesce(_description,'')) else 'Prazo: ' || to_char(_due_at at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') end,
    '/aluno#tarefas'
  );

  return result_row;
end;
$$;

revoke all on function public.teacher_list_students() from public, authenticated;
revoke all on function public.teacher_link_student(uuid,text,text) from public, authenticated;
revoke all on function public.teacher_unlink_student(uuid) from public, authenticated;

grant execute on function public.teacher_list_roster() to authenticated;
grant execute on function public.teacher_link_roster_student(uuid,text,text) to authenticated;
grant execute on function public.teacher_unlink_roster_student(uuid) to authenticated;
grant execute on function public.teacher_bulk_upsert_grades(uuid,text,integer,jsonb) to authenticated;
grant execute on function public.student_list_notifications(boolean,integer) to authenticated;
grant execute on function public.student_mark_notification_read(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;


-- Defense in depth: academic writes are performed through authorization-aware RPCs.
revoke insert, update, delete on public.students from authenticated;
revoke insert, update, delete on public.announcements from authenticated;
revoke insert, update, delete on public.tasks from authenticated;
revoke insert, update, delete on public.grades from authenticated;
revoke insert, update on public.task_completions from authenticated;

drop policy if exists "Teachers can insert announcements" on public.announcements;
create policy "Teachers can insert announcements"
on public.announcements
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and public.has_role((select auth.uid()), 'teacher'::public.app_role)
  and exists (
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id = ct.classroom_id
    where ct.user_id = (select auth.uid())
      and ct.classroom_id = announcements.classroom_id
      and c.institution_id = announcements.institution_id
      and c.status = 'active'
  )
);

drop policy if exists "Teachers can update own announcements" on public.announcements;
create policy "Teachers can update own announcements"
on public.announcements
for update to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and public.has_role((select auth.uid()), 'teacher'::public.app_role)
  and exists (
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id = ct.classroom_id
    where ct.user_id = (select auth.uid())
      and ct.classroom_id = announcements.classroom_id
      and c.institution_id = announcements.institution_id
      and c.status = 'active'
  )
);

drop policy if exists "Teachers can insert tasks" on public.tasks;
create policy "Teachers can insert tasks"
on public.tasks
for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and public.has_role((select auth.uid()), 'teacher'::public.app_role)
  and exists (
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id = ct.classroom_id
    where ct.user_id = (select auth.uid())
      and ct.classroom_id = tasks.classroom_id
      and c.institution_id = tasks.institution_id
      and c.status = 'active'
  )
);

drop policy if exists "Teachers can update own tasks" on public.tasks;
create policy "Teachers can update own tasks"
on public.tasks
for update to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and public.has_role((select auth.uid()), 'teacher'::public.app_role)
  and exists (
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id = ct.classroom_id
    where ct.user_id = (select auth.uid())
      and ct.classroom_id = tasks.classroom_id
      and c.institution_id = tasks.institution_id
      and c.status = 'active'
  )
);


-- SECURITY DEFINER functions in public are explicit application APIs.
revoke execute on function public.admin_list_accounts() from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;

revoke execute on function public.admin_set_account_status(uuid,text) from public, anon;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;

revoke execute on function public.student_list_announcements() from public, anon;
grant execute on function public.student_list_announcements() to authenticated;

revoke execute on function public.student_list_tasks() from public, anon;
grant execute on function public.student_list_tasks() to authenticated;

revoke execute on function public.student_set_task_completed(uuid,boolean) from public, anon;
grant execute on function public.student_set_task_completed(uuid,boolean) to authenticated;

revoke execute on function public.teacher_bulk_upsert_grades(uuid,text,integer,jsonb) from public, anon;
grant execute on function public.teacher_bulk_upsert_grades(uuid,text,integer,jsonb) to authenticated;

revoke execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public, anon;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;

revoke execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) from public, anon;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;

revoke execute on function public.teacher_delete_announcement(uuid) from public, anon;
grant execute on function public.teacher_delete_announcement(uuid) to authenticated;

revoke execute on function public.teacher_delete_task(uuid) from public, anon;
grant execute on function public.teacher_delete_task(uuid) to authenticated;

revoke execute on function public.teacher_link_roster_student(uuid,text,text) from public, anon;
grant execute on function public.teacher_link_roster_student(uuid,text,text) to authenticated;

revoke execute on function public.teacher_list_announcements() from public, anon;
grant execute on function public.teacher_list_announcements() to authenticated;

revoke execute on function public.teacher_list_roster() from public, anon;
grant execute on function public.teacher_list_roster() to authenticated;

revoke execute on function public.teacher_list_tasks() from public, anon;
grant execute on function public.teacher_list_tasks() to authenticated;

revoke execute on function public.teacher_unlink_roster_student(uuid) from public, anon;
grant execute on function public.teacher_unlink_roster_student(uuid) to authenticated;

revoke execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) from public, anon;
grant execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) to authenticated;

revoke execute on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) from public, anon;
grant execute on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;

-- Invoker notification readers are authenticated-only application APIs too.
revoke execute on function public.student_list_notifications(boolean,integer) from public, anon;
grant execute on function public.student_list_notifications(boolean,integer) to authenticated;

revoke execute on function public.student_mark_notification_read(uuid) from public, anon;
grant execute on function public.student_mark_notification_read(uuid) to authenticated;

revoke execute on function public.teacher_unlink_student(uuid) from public, anon, authenticated;
