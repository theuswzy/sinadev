-- Panel audit: tenant-safe student context, teacher grade access and direct-read RLS hardening.

create or replace function public.admin_review_role_request(
  _request_id uuid,
  _decision text,
  _approved_role text,
  _note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  req public.account_role_requests;
  inst uuid;
  title_text text;
  body_text text;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;
  if _decision not in ('approved','rejected') then
    raise exception 'Decisão inválida.';
  end if;

  select * into req
  from public.account_role_requests
  where id=_request_id
  for update;

  if req.id is null then return false; end if;
  if req.status <> 'pending' then raise exception 'Esta solicitação já foi processada.'; end if;

  if _decision='rejected' then
    update public.account_role_requests
    set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
        review_note=nullif(trim(_note),''),updated_at=now()
    where id=_request_id;

    update public.profiles set status='pending',updated_at=now() where user_id=req.user_id;

    title_text := 'Cadastro aguardando nova análise';
    body_text := coalesce(nullif(trim(_note),''),'Sua solicitação de acesso não foi aprovada. Você pode enviar uma nova solicitação.');

    insert into public.notifications(user_id,type,title,body,link,metadata)
    values(req.user_id,'account_review',title_text,body_text,'/auth',
      jsonb_build_object('request_id',req.id,'decision','rejected'));
    return true;
  end if;

  if _approved_role not in ('student','teacher') then
    raise exception 'Selecione uma função válida para aprovar.';
  end if;

  inst := req.institution_id;

  if inst is null and req.school_directory_id is not null then
    select d.institution_id
      into inst
    from public.school_directory d
    where d.id=req.school_directory_id
      and d.status='active';
  end if;

  if inst is null then
    raise exception 'A solicitação não possui uma instituição válida. Verifique a escola selecionada.';
  end if;

  delete from public.user_roles
  where user_id=req.user_id
    and role in ('student'::public.app_role,'teacher'::public.app_role);

  insert into public.user_roles(user_id,role)
  values(req.user_id,_approved_role::public.app_role);

  delete from public.institution_memberships
  where user_id=req.user_id
    and role in ('student'::public.app_role,'teacher'::public.app_role);

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(inst,req.user_id,_approved_role::public.app_role,'active')
  on conflict(institution_id,user_id,role)
  do update set status='active',updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(req.user_id,inst)
  on conflict(user_id)
  do update set institution_id=excluded.institution_id,updated_at=now();

  update public.profiles set status='active',updated_at=now() where user_id=req.user_id;

  if _approved_role='student' then
    perform public.ensure_student_profile_for_user(req.user_id);
    update public.students set institution_id=inst where user_id=req.user_id;
  end if;

  update public.account_role_requests
  set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),
      review_note=nullif(trim(_note),''),institution_id=inst,updated_at=now()
  where id=_request_id;

  title_text := 'Cadastro aprovado';
  body_text := case when _approved_role='teacher'
    then 'Seu acesso de professor foi aprovado. Agora você já pode entrar na área do professor.'
    else 'Seu acesso de aluno foi aprovado. Agora você já pode entrar na área do aluno.'
  end;

  insert into public.notifications(user_id,type,title,body,link,metadata)
  values(req.user_id,'account_review',title_text,body_text,
    case when _approved_role='teacher' then '/professor' else '/aluno' end,
    jsonb_build_object('request_id',req.id,'decision','approved','role',_approved_role,'institution_id',inst));

  return true;
end;
$function$;

create or replace function public.ensure_student_profile()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  existing_role public.app_role;
  display_name text;
  v_institution uuid := sina_private.current_institution('student'::public.app_role);
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;

  select ur.role into existing_role
  from public.user_roles ur
  where ur.user_id=uid
    and ur.role in ('admin'::public.app_role,'teacher'::public.app_role)
  order by case when ur.role='admin'::public.app_role then 0 else 1 end
  limit 1;

  if existing_role is not null then return false; end if;

  select coalesce(
    nullif(p.display_name,''),
    nullif(au.raw_user_meta_data->>'display_name',''),
    split_part(coalesce(au.email,''),'@',1)
  )
  into display_name
  from auth.users au
  left join public.profiles p on p.user_id=au.id
  where au.id=uid;

  insert into public.students(user_id,full_name,enrollment,classroom,teacher_id,institution_id)
  values(uid,coalesce(display_name,'Aluno'),'','',null,v_institution)
  on conflict (user_id) where user_id is not null
  do update set
    full_name=coalesce(nullif(public.students.full_name,''),excluded.full_name),
    institution_id=coalesce(public.students.institution_id,excluded.institution_id),
    updated_at=now();

  return true;
end;
$function$;

create or replace function sina_private.set_academic_role(_user_id uuid,_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_institution uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;
  if _role not in ('student','teacher') or _role is null then
    raise exception 'Função acadêmica inválida.';
  end if;
  if not exists(select 1 from auth.users where id=_user_id) then return false; end if;
  if public.has_role(_user_id,'admin'::public.app_role) then
    raise exception 'A função acadêmica de um administrador não pode ser alterada nesta tela.';
  end if;

  v_institution:=sina_private.current_institution('admin'::public.app_role);
  if v_institution is null then
    raise exception 'Nenhuma instituição administrativa ativa encontrada.';
  end if;

  delete from public.user_roles
  where user_id=_user_id
    and role in ('student'::public.app_role,'teacher'::public.app_role);

  insert into public.user_roles(user_id,role)
  values(_user_id,_role::public.app_role);

  delete from public.institution_memberships
  where user_id=_user_id
    and role in ('student'::public.app_role,'teacher'::public.app_role);

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(
    v_institution,
    _user_id,
    _role::public.app_role,
    coalesce((select p.status from public.profiles p where p.user_id=_user_id limit 1),'active')
  )
  on conflict(institution_id,user_id,role)
  do update set status=excluded.status,updated_at=now();

  insert into public.user_institution_context(user_id,institution_id)
  values(_user_id,v_institution)
  on conflict(user_id)
  do update set institution_id=excluded.institution_id,updated_at=now();

  return true;
end;
$function$;

create or replace function public.student_get_profile()
returns setof public.students
language sql
security definer
set search_path = ''
as $function$
  select s.*
  from public.students s
  where s.user_id=auth.uid()
    and s.institution_id=sina_private.current_institution('student'::public.app_role)
  order by s.updated_at desc
  limit 1;
$function$;

create or replace function sina_private.list_student_grades()
returns setof public.grades
language sql
stable
security definer
set search_path = ''
as $function$
  select g.*
  from public.grades g
  join public.students s on s.id=g.student_id
  where s.user_id=auth.uid()
    and s.institution_id=sina_private.current_institution('student'::public.app_role)
    and g.institution_id=s.institution_id
  order by g.subject,g.period;
$function$;

create or replace function public.student_list_attendance(_limit integer default 60)
returns table(attendance_date date,status text,note text,classroom text)
language sql
stable
security definer
set search_path = ''
as $function$
  select a.attendance_date,a.status,a.note,c.name
  from public.attendance_records a
  join public.students s on s.id=a.student_id
  join public.classrooms c on c.id=a.classroom_id
  where s.user_id=auth.uid()
    and s.institution_id=sina_private.current_institution('student'::public.app_role)
    and a.institution_id=s.institution_id
  order by a.attendance_date desc
  limit greatest(1,least(_limit,180));
$function$;

create or replace function public.student_list_assessments()
returns table(
  id uuid,title text,assessment_type text,weight numeric,max_score numeric,
  due_at timestamp with time zone,status text,subject_name text,term_name text,
  score numeric,feedback text
)
language sql
security definer
set search_path = ''
as $function$
  select a.id,a.title,a.assessment_type,a.weight,a.max_score,a.due_at,a.status,
         coalesce(su.name,a.title),coalesce(t.name,''),
         sc.score,sc.feedback
  from public.assessments a
  join public.students st
    on st.classroom_id=a.classroom_id
   and st.user_id=auth.uid()
   and st.institution_id=a.institution_id
  left join public.subjects su on su.id=a.subject_id
  left join public.academic_terms t on t.id=a.term_id
  left join public.assessment_scores sc
    on sc.assessment_id=a.id
   and sc.student_id=st.id
  where a.status <> 'draft'
    and a.institution_id=sina_private.current_institution('student'::public.app_role)
  order by coalesce(a.due_at,a.created_at) desc;
$function$;

create or replace function public.student_list_academic_materials()
returns table(
  id uuid,classroom_id uuid,classroom_name text,subject_id uuid,subject_name text,
  term_id uuid,term_name text,title text,description text,file_path text,file_name text,
  file_size bigint,file_type text,created_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $function$
  select m.id,m.classroom_id,c.name,m.subject_id,s.name,m.term_id,t.name,
         m.title,m.description,m.file_path,m.file_name,m.file_size,m.file_type,m.created_at
  from public.academic_materials m
  join public.students st
    on st.classroom_id=m.classroom_id
   and st.user_id=auth.uid()
   and st.institution_id=m.institution_id
  join public.classrooms c on c.id=m.classroom_id
  left join public.subjects s on s.id=m.subject_id
  left join public.academic_terms t on t.id=m.term_id
  where m.status='active'
    and m.institution_id=sina_private.current_institution('student'::public.app_role)
  order by m.created_at desc;
$function$;

create or replace function public.student_list_calendar(
  _from timestamp with time zone,
  _to timestamp with time zone
)
returns table(
  id uuid,classroom_id uuid,classroom_name text,title text,description text,
  start_at timestamp with time zone,end_at timestamp with time zone,
  event_type text,status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select e.id,e.classroom_id,c.name,e.title,e.description,e.start_at,e.end_at,e.event_type,e.status
  from public.calendar_events e
  left join public.classrooms c on c.id=e.classroom_id
  join public.students s
    on s.user_id=auth.uid()
   and s.institution_id=e.institution_id
  where e.institution_id=sina_private.current_institution('student'::public.app_role)
    and e.start_at < _to
    and coalesce(e.end_at,e.start_at) >= _from
    and (e.classroom_id is null or e.classroom_id=s.classroom_id)
  order by e.start_at;
$function$;

create or replace function sina_private.list_teacher_grades(_student_id uuid)
returns setof public.grades
language sql
stable
security definer
set search_path = ''
as $function$
  select g.*
  from public.grades g
  join public.students s on s.id=g.student_id
  where s.id=_student_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and exists (
      select 1
      from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where ct.classroom_id=s.classroom_id
        and ct.user_id=auth.uid()
        and c.institution_id=s.institution_id
        and c.status='active'
    )
    and g.institution_id=s.institution_id
  order by g.subject,g.period;
$function$;

drop policy if exists "Students and owners can read tasks" on public.tasks;
create policy "Students and owners can read tasks"
on public.tasks
for select
to authenticated
using (
  teacher_id=auth.uid()
  or exists (
    select 1
    from public.students s
    where s.user_id=auth.uid()
      and s.institution_id=tasks.institution_id
      and (
        s.classroom_id=tasks.classroom_id
        or (tasks.classroom_id is null and s.classroom=tasks.classroom)
      )
  )
);

drop policy if exists "Students and owners can read announcements" on public.announcements;
create policy "Students and owners can read announcements"
on public.announcements
for select
to authenticated
using (
  teacher_id=auth.uid()
  or exists (
    select 1
    from public.students s
    where s.user_id=auth.uid()
      and s.institution_id=announcements.institution_id
      and (
        s.classroom_id=announcements.classroom_id
        or (announcements.classroom_id is null and s.classroom=announcements.classroom)
      )
);

drop policy if exists "student grades read" on public.grades;
create policy "student grades read"
on public.grades
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id=grades.student_id
      and s.user_id=auth.uid()
      and s.institution_id=sina_private.current_institution('student'::public.app_role)
      and grades.institution_id=s.institution_id
  )
);

drop policy if exists "teacher grades read" on public.grades;
create policy "teacher grades read"
on public.grades
for select
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id=grades.student_id
      and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
      and s.institution_id=grades.institution_id
      and exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      )
  )
);

drop policy if exists "teacher grades create" on public.grades;
create policy "teacher grades create"
on public.grades
for insert
to authenticated
with check (
  exists (
    select 1
    from public.students s
    where s.id=grades.student_id
      and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
      and grades.institution_id=s.institution_id
      and exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      )
  )
);

drop policy if exists "teacher grades edit" on public.grades;
create policy "teacher grades edit"
on public.grades
for update
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id=grades.student_id
      and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
      and s.institution_id=grades.institution_id
      and exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      )
  )
)
with check (
  exists (
    select 1
    from public.students s
    where s.id=grades.student_id
      and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
      and s.institution_id=grades.institution_id
      and exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      )
  )
);

drop policy if exists "teacher grades delete" on public.grades;
create policy "teacher grades delete"
on public.grades
for delete
to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id=grades.student_id
      and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
      and s.institution_id=grades.institution_id
      and exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      )
  )
);