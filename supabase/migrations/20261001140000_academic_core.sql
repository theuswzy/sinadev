-- SINA academic operations: attendance, assessments, submissions, calendar and setup.

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present','absent','late','excused')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  term_id uuid references public.academic_terms(id) on delete set null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  assessment_type text not null default 'prova',
  weight numeric not null default 1 check (weight > 0 and weight <= 100),
  max_score numeric not null default 10 check (max_score > 0 and max_score <= 100),
  due_at timestamptz,
  status text not null default 'published' check (status in ('draft','published','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_scores (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric check (score is null or score >= 0),
  feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  content text not null default '',
  attachment_path text,
  attachment_name text,
  attachment_size bigint,
  attachment_type text,
  status text not null default 'submitted' check (status in ('draft','submitted','graded','returned')),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  score numeric check (score is null or score >= 0),
  feedback text,
  updated_at timestamptz not null default now(),
  unique (task_id, student_id)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,
  event_type text not null default 'aula' check (event_type in ('aula','prova','trabalho','evento','recesso','outro')),
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists subject_id uuid references public.subjects(id) on delete set null;
alter table public.tasks add column if not exists term_id uuid references public.academic_terms(id) on delete set null;

create index if not exists attendance_records_classroom_date_idx on public.attendance_records(classroom_id, attendance_date);
create index if not exists attendance_records_student_date_idx on public.attendance_records(student_id, attendance_date);
create index if not exists assessments_classroom_idx on public.assessments(classroom_id, due_at);
create index if not exists assessment_scores_student_idx on public.assessment_scores(student_id);
create index if not exists task_submissions_task_idx on public.task_submissions(task_id, status);
create index if not exists calendar_events_range_idx on public.calendar_events(institution_id, start_at);
create index if not exists tasks_subject_term_idx on public.tasks(subject_id, term_id);

alter table public.attendance_records enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_scores enable row level security;
alter table public.task_submissions enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "Attendance visible to institution members" on public.attendance_records;
create policy "Attendance visible to institution members"
on public.attendance_records for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.user_id = (select auth.uid())
      and m.institution_id = attendance_records.institution_id
      and m.status = 'active'
  )
  and (
    student_id = (select s.id from public.students s where s.user_id = (select auth.uid()) limit 1)
    or teacher_id = (select auth.uid())
    or (select public.has_role((select auth.uid()), 'admin'))
  )
);

drop policy if exists "Assessments visible to institution members" on public.assessments;
create policy "Assessments visible to institution members"
on public.assessments for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.user_id = (select auth.uid())
      and m.institution_id = assessments.institution_id
      and m.status = 'active'
  )
);

drop policy if exists "Assessment scores visible to institution members" on public.assessment_scores;
create policy "Assessment scores visible to institution members"
on public.assessment_scores for select to authenticated
using (
  exists (
    select 1
    from public.assessments a
    join public.institution_memberships m on m.institution_id = a.institution_id
    where a.id = assessment_scores.assessment_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  and (
    student_id = (select s.id from public.students s where s.user_id = (select auth.uid()) limit 1)
    or exists (
      select 1 from public.assessments a
      where a.id = assessment_scores.assessment_id
        and (a.teacher_id = (select auth.uid()) or (select public.has_role((select auth.uid()), 'admin')))
    )
  )
);

drop policy if exists "Task submissions visible to owners" on public.task_submissions;
create policy "Task submissions visible to owners"
on public.task_submissions for select to authenticated
using (
  student_id = (select s.id from public.students s where s.user_id = (select auth.uid()) limit 1)
  or exists (
    select 1
    from public.tasks t
    where t.id = task_submissions.task_id
      and t.teacher_id = (select auth.uid())
  )
  or (select public.has_role((select auth.uid()), 'admin'))
);

drop policy if exists "Calendar events visible to institution members" on public.calendar_events;
create policy "Calendar events visible to institution members"
on public.calendar_events for select to authenticated
using (
  exists (
    select 1 from public.institution_memberships m
    where m.user_id = (select auth.uid())
      and m.institution_id = calendar_events.institution_id
      and m.status = 'active'
  )
  and (
    classroom_id is null
    or exists (
      select 1 from public.students s
      where s.user_id = (select auth.uid()) and s.classroom_id = calendar_events.classroom_id
    )
    or created_by = (select auth.uid())
    or (select public.has_role((select auth.uid()), 'admin'))
  )
);

create or replace function public.teacher_list_classrooms()
returns table(id uuid, name text, code text, status text, student_count bigint)
language sql stable security definer set search_path=''
as $$
  select c.id, c.name, c.code, c.status, count(s.id)::bigint
  from public.classrooms c
  left join public.students s on s.classroom_id = c.id and s.teacher_id = auth.uid()
  where c.institution_id = (select sina_private.current_institution('teacher'::public.app_role))
  group by c.id
  order by c.name;
$$;

create or replace function public.teacher_get_attendance(_classroom_id uuid, _date date)
returns table(student_id uuid, full_name text, enrollment text, status text, note text)
language sql stable security definer set search_path=''
as $$
  select s.id, s.full_name, s.enrollment,
         coalesce(a.status, 'present') as status,
         coalesce(a.note, '') as note
  from public.students s
  left join public.attendance_records a
    on a.student_id = s.id and a.attendance_date = _date
  where s.teacher_id = auth.uid()
    and s.classroom_id = _classroom_id
    and s.institution_id = (select sina_private.current_institution('teacher'::public.app_role))
  order by s.full_name;
$$;

create or replace function public.teacher_save_attendance(_classroom_id uuid, _date date, _rows jsonb)
returns integer
language plpgsql security definer set search_path=''
as $$
declare
  inst uuid;
  teacher uuid := auth.uid();
  item jsonb;
  total integer := 0;
  student uuid;
  stat text;
  note_text text;
begin
  if not public.has_role(teacher, 'teacher'::public.app_role) then
    raise exception 'Acesso restrito ao professor';
  end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Instituição não encontrada'; end if;
  if not exists (select 1 from public.classrooms c where c.id=_classroom_id and c.institution_id=inst) then
    raise exception 'Turma inválida';
  end if;

  for item in select * from jsonb_array_elements(coalesce(_rows,'[]'::jsonb))
  loop
    student := (item->>'student_id')::uuid;
    stat := coalesce(item->>'status','present');
    note_text := coalesce(item->>'note','');
    if stat not in ('present','absent','late','excused') then raise exception 'Situação de frequência inválida'; end if;
    if exists (
      select 1 from public.students s
      where s.id=student and s.teacher_id=teacher and s.classroom_id=_classroom_id and s.institution_id=inst
    ) then
      insert into public.attendance_records(institution_id,classroom_id,student_id,teacher_id,attendance_date,status,note,updated_at)
      values(inst,_classroom_id,student,teacher,_date,stat,nullif(note_text,''),now())
      on conflict(student_id,attendance_date) do update
      set classroom_id=excluded.classroom_id, teacher_id=excluded.teacher_id,
          status=excluded.status, note=excluded.note, updated_at=now();
      total := total + 1;
    end if;
  end loop;
  return total;
end;
$$;

create or replace function public.student_list_attendance(_limit integer default 60)
returns table(attendance_date date, status text, note text, classroom text)
language sql stable security definer set search_path=''
as $$
  select a.attendance_date, a.status, a.note, c.name
  from public.attendance_records a
  join public.students s on s.id=a.student_id
  join public.classrooms c on c.id=a.classroom_id
  where s.user_id=auth.uid()
  order by a.attendance_date desc
  limit greatest(1, least(_limit, 180));
$$;

create or replace function public.teacher_list_assessments(_classroom_id uuid)
returns table(id uuid, title text, assessment_type text, weight numeric, max_score numeric, due_at timestamptz, status text, subject_id uuid, subject_name text, term_id uuid, term_name text)
language sql stable security definer set search_path=''
as $$
  select a.id,a.title,a.assessment_type,a.weight,a.max_score,a.due_at,a.status,
         a.subject_id,coalesce(su.name,''),a.term_id,coalesce(t.name,'')
  from public.assessments a
  left join public.subjects su on su.id=a.subject_id
  left join public.academic_terms t on t.id=a.term_id
  where a.teacher_id=auth.uid()
    and a.classroom_id=_classroom_id
    and a.institution_id=(select sina_private.current_institution('teacher'::public.app_role))
  order by coalesce(a.due_at,a.created_at) desc;
$$;

create or replace function public.teacher_create_assessment(
  _classroom_id uuid, _subject_id uuid, _term_id uuid, _title text, _type text,
  _weight numeric, _max_score numeric, _due_at timestamptz
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; assessment_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  inst := sina_private.current_institution('teacher'::public.app_role);
  if not exists(select 1 from public.classrooms c where c.id=_classroom_id and c.institution_id=inst) then raise exception 'Turma inválida'; end if;
  if not exists(select 1 from public.students s where s.classroom_id=_classroom_id and s.teacher_id=auth.uid() limit 1) then raise exception 'Você não possui acesso a esta turma'; end if;
  if _subject_id is not null and not exists(select 1 from public.subjects su where su.id=_subject_id and su.institution_id=inst and su.status='active') then raise exception 'Disciplina inválida'; end if;
  if _term_id is not null and not exists(select 1 from public.academic_terms t where t.id=_term_id and t.institution_id=inst) then raise exception 'Período acadêmico inválido'; end if;
  insert into public.assessments(institution_id,classroom_id,subject_id,term_id,teacher_id,title,assessment_type,weight,max_score,due_at)
  values(inst,_classroom_id,_subject_id,_term_id,auth.uid(),trim(_title),coalesce(nullif(trim(_type),''),'prova'),greatest(0.01,_weight),greatest(0.01,_max_score),_due_at)
  returning id into assessment_id;
  return assessment_id;
end;
$$;

create or replace function public.teacher_upsert_assessment_score(
  _assessment_id uuid, _student_id uuid, _score numeric, _feedback text
)
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  if not exists(
    select 1 from public.assessments a join public.students s on s.classroom_id=a.classroom_id
    where a.id=_assessment_id and a.teacher_id=auth.uid() and s.id=_student_id
  ) then raise exception 'Avaliação ou aluno inválido'; end if;
  insert into public.assessment_scores(assessment_id,student_id,score,feedback,graded_at,graded_by,submitted_at,updated_at)
  values(_assessment_id,_student_id,_score,_feedback,now(),auth.uid(),now(),now())
  on conflict(assessment_id,student_id) do update
  set score=excluded.score, feedback=excluded.feedback, graded_at=now(), graded_by=auth.uid(), updated_at=now();
  return true;
end;
$$;

create or replace function public.student_list_assessments()
returns table(id uuid,title text,assessment_type text,weight numeric,max_score numeric,due_at timestamptz,status text,
  subject_name text,term_name text,score numeric,feedback text)
language sql stable security definer set search_path=''
as $$
  select a.id,a.title,a.assessment_type,a.weight,a.max_score,a.due_at,a.status,
         coalesce(su.name,a.title),coalesce(t.name,''),sc.score,sc.feedback
  from public.assessments a
  join public.students st on st.classroom_id=a.classroom_id and st.user_id=auth.uid()
  left join public.subjects su on su.id=a.subject_id
  left join public.academic_terms t on t.id=a.term_id
  left join public.assessment_scores sc on sc.assessment_id=a.id and sc.student_id=st.id
  where a.status <> 'draft'
  order by coalesce(a.due_at,a.created_at) desc;
$$;

create or replace function public.student_submit_task(_task_id uuid, _content text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare sid uuid; sub_id uuid;
begin
  select id into sid from public.students where user_id=auth.uid() limit 1;
  if sid is null then raise exception 'Perfil de aluno não encontrado'; end if;
  if not exists(
    select 1 from public.tasks t join public.students s on s.classroom=t.classroom and s.id=sid where t.id=_task_id
  ) then
    raise exception 'Atividade indisponível';
  end if;
  insert into public.task_submissions(task_id,student_id,content,status,submitted_at,updated_at)
  values(_task_id,sid,coalesce(_content,''),'submitted',now(),now())
  on conflict(task_id,student_id) do update
  set content=excluded.content,status='submitted',submitted_at=now(),updated_at=now();
  select id into sub_id from public.task_submissions where task_id=_task_id and student_id=sid;
  return sub_id;
end;
$$;

create or replace function public.student_list_task_submissions()
returns table(id uuid,task_id uuid,content text,attachment_path text,attachment_name text,status text,submitted_at timestamptz,score numeric,feedback text)
language sql stable security definer set search_path=''
as $$
  select ts.id,ts.task_id,ts.content,ts.attachment_path,ts.attachment_name,ts.status,ts.submitted_at,ts.score,ts.feedback
  from public.task_submissions ts
  join public.students s on s.id=ts.student_id
  where s.user_id=auth.uid()
  order by ts.submitted_at desc;
$$;

create or replace function public.teacher_list_task_submissions(_task_id uuid)
returns table(id uuid,task_id uuid,student_id uuid,student_name text,enrollment text,content text,status text,submitted_at timestamptz,score numeric,feedback text)
language sql stable security definer set search_path=''
as $$
  select ts.id,ts.task_id,ts.student_id,s.full_name,s.enrollment,ts.content,ts.status,ts.submitted_at,ts.score,ts.feedback
  from public.task_submissions ts
  join public.students s on s.id=ts.student_id
  join public.tasks t on t.id=ts.task_id
  where t.id=_task_id and t.teacher_id=auth.uid()
  order by s.full_name;
$$;

create or replace function public.teacher_grade_submission(_submission_id uuid,_score numeric,_feedback text)
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  if not exists(
    select 1 from public.task_submissions ts join public.tasks t on t.id=ts.task_id
    where ts.id=_submission_id and t.teacher_id=auth.uid()
  ) then raise exception 'Entrega não pertence às suas turmas'; end if;
  update public.task_submissions
  set score=_score,feedback=_feedback,status='graded',graded_at=now(),updated_at=now()
  where id=_submission_id;
  return true;
end;
$$;

create or replace function public.teacher_list_calendar(_from timestamptz,_to timestamptz)
returns table(id uuid,classroom_id uuid,classroom_name text,title text,description text,start_at timestamptz,end_at timestamptz,event_type text,status text)
language sql stable security definer set search_path=''
as $$
  select e.id,e.classroom_id,c.name,e.title,e.description,e.start_at,e.end_at,e.event_type,e.status
  from public.calendar_events e
  left join public.classrooms c on c.id=e.classroom_id
  where e.created_by=auth.uid()
    and e.institution_id=(select sina_private.current_institution('teacher'::public.app_role))
    and e.start_at < _to and coalesce(e.end_at,e.start_at) >= _from
  order by e.start_at;
$$;

create or replace function public.student_list_calendar(_from timestamptz,_to timestamptz)
returns table(id uuid,classroom_id uuid,classroom_name text,title text,description text,start_at timestamptz,end_at timestamptz,event_type text,status text)
language sql stable security definer set search_path=''
as $$
  select e.id,e.classroom_id,c.name,e.title,e.description,e.start_at,e.end_at,e.event_type,e.status
  from public.calendar_events e
  left join public.classrooms c on c.id=e.classroom_id
  join public.students s on s.user_id=auth.uid()
  where e.institution_id=s.institution_id
    and e.start_at < _to and coalesce(e.end_at,e.start_at) >= _from
    and (e.classroom_id is null or e.classroom_id=s.classroom_id)
  order by e.start_at;
$$;

create or replace function public.teacher_create_calendar_event(
  _classroom_id uuid,_title text,_description text,_start_at timestamptz,_end_at timestamptz,_event_type text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; event_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if _classroom_id is not null and not exists(select 1 from public.students s where s.teacher_id=auth.uid() and s.classroom_id=_classroom_id) then raise exception 'Turma inválida'; end if;
  insert into public.calendar_events(institution_id,classroom_id,created_by,title,description,start_at,end_at,event_type)
  values(inst,_classroom_id,auth.uid(),trim(_title),coalesce(_description,''),_start_at,_end_at,coalesce(nullif(_event_type,''),'aula'))
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.admin_list_academic_setup()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito ao administrador'; end if;
  inst:=sina_private.current_institution('admin'::public.app_role);
  return jsonb_build_object(
    'classrooms', coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.classrooms c where c.institution_id=inst),'[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(to_jsonb(su) order by su.name) from public.subjects su where su.institution_id=inst),'[]'::jsonb),
    'terms', coalesce((select jsonb_agg(to_jsonb(t) order by t.starts_at nulls last,t.name) from public.academic_terms t where t.institution_id=inst),'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_upsert_classroom(_id uuid,_name text,_code text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito ao administrador'; end if;
  inst:=sina_private.current_institution('admin'::public.app_role);
  if _id is null then
    insert into public.classrooms(institution_id,name,code) values(inst,trim(_name),nullif(trim(_code),'')) returning id into row_id;
  else
    update public.classrooms set name=trim(_name),code=nullif(trim(_code),''),updated_at=now() where id=_id and institution_id=inst returning id into row_id;
    if row_id is null then raise exception 'Turma não encontrada'; end if;
  end if;
  return row_id;
end;
$$;

create or replace function public.admin_archive_classroom(_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito ao administrador'; end if;
  update public.classrooms set status='archived',updated_at=now()
  where id=_id and institution_id=(select sina_private.current_institution('admin'::public.app_role));
  return found;
end;
$$;

create or replace function public.admin_upsert_subject(_id uuid,_name text,_code text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito ao administrador'; end if;
  inst:=sina_private.current_institution('admin'::public.app_role);
  if _id is null then
    insert into public.subjects(institution_id,name,code) values(inst,trim(_name),nullif(trim(_code),'')) returning id into row_id;
  else
    update public.subjects set name=trim(_name),code=nullif(trim(_code),''),updated_at=now() where id=_id and institution_id=inst returning id into row_id;
    if row_id is null then raise exception 'Disciplina não encontrada'; end if;
  end if;
  return row_id;
end;
$$;

create or replace function public.admin_upsert_term(_id uuid,_name text,_starts_at date,_ends_at date,_is_current boolean)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Acesso restrito ao administrador'; end if;
  inst:=sina_private.current_institution('admin'::public.app_role);
  if _is_current then update public.academic_terms set is_current=false,updated_at=now() where institution_id=inst; end if;
  if _id is null then
    insert into public.academic_terms(institution_id,name,starts_at,ends_at,is_current) values(inst,trim(_name),_starts_at,_ends_at,_is_current) returning id into row_id;
  else
    update public.academic_terms set name=trim(_name),starts_at=_starts_at,ends_at=_ends_at,is_current=_is_current,updated_at=now() where id=_id and institution_id=inst returning id into row_id;
    if row_id is null then raise exception 'Período não encontrado'; end if;
  end if;
  return row_id;
end;
$$;

create or replace function public.teacher_get_class_report(_classroom_id uuid)
returns table(student_id uuid,student_name text,enrollment text,attendance_percent numeric,grade_average numeric,assessment_count bigint)
language sql stable security definer set search_path=''
as $$
  select s.id,s.full_name,s.enrollment,
    coalesce(round((count(*) filter (where ar.status in ('present','late'))::numeric / nullif(count(ar.id),0))*100,1), s.attendance),
    coalesce(round(avg(g.score),2),0),
    (select count(*) from public.assessment_scores sc join public.assessments a on a.id=sc.assessment_id where sc.student_id=s.id and a.classroom_id=_classroom_id)
  from public.students s
  left join public.attendance_records ar on ar.student_id=s.id and ar.classroom_id=_classroom_id
  left join public.grades g on g.student_id=s.id
  where s.teacher_id=auth.uid() and s.classroom_id=_classroom_id
  group by s.id,s.full_name,s.enrollment,s.attendance
  order by s.full_name;
$$;

revoke all on function public.teacher_list_classrooms() from public, anon;
revoke all on function public.teacher_get_attendance(uuid,date) from public, anon;
revoke all on function public.teacher_save_attendance(uuid,date,jsonb) from public, anon;
revoke all on function public.student_list_attendance(integer) from public, anon;
revoke all on function public.teacher_list_assessments(uuid) from public, anon;
revoke all on function public.teacher_create_assessment(uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) from public, anon;
revoke all on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) from public, anon;
revoke all on function public.student_list_assessments() from public, anon;
revoke all on function public.student_submit_task(uuid,text) from public, anon;
revoke all on function public.student_list_task_submissions() from public, anon;
revoke all on function public.teacher_list_task_submissions(uuid) from public, anon;
revoke all on function public.teacher_grade_submission(uuid,numeric,text) from public, anon;
revoke all on function public.teacher_list_calendar(timestamptz,timestamptz) from public, anon;
revoke all on function public.student_list_calendar(timestamptz,timestamptz) from public, anon;
revoke all on function public.teacher_create_calendar_event(uuid,text,text,timestamptz,timestamptz,text) from public, anon;
revoke all on function public.admin_list_academic_setup() from public, anon;
revoke all on function public.admin_upsert_classroom(uuid,text,text) from public, anon;
revoke all on function public.admin_archive_classroom(uuid) from public, anon;
revoke all on function public.admin_upsert_subject(uuid,text,text) from public, anon;
revoke all on function public.admin_upsert_term(uuid,text,date,date,boolean) from public, anon;
revoke all on function public.teacher_get_class_report(uuid) from public, anon;

grant execute on function public.teacher_list_classrooms() to authenticated;
grant execute on function public.teacher_get_attendance(uuid,date) to authenticated;
grant execute on function public.teacher_save_attendance(uuid,date,jsonb) to authenticated;
grant execute on function public.student_list_attendance(integer) to authenticated;
grant execute on function public.teacher_list_assessments(uuid) to authenticated;
grant execute on function public.teacher_create_assessment(uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) to authenticated;
grant execute on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.student_list_assessments() to authenticated;
grant execute on function public.student_submit_task(uuid,text) to authenticated;
grant execute on function public.student_list_task_submissions() to authenticated;
grant execute on function public.teacher_list_task_submissions(uuid) to authenticated;
grant execute on function public.teacher_grade_submission(uuid,numeric,text) to authenticated;
grant execute on function public.teacher_list_calendar(timestamptz,timestamptz) to authenticated;
grant execute on function public.student_list_calendar(timestamptz,timestamptz) to authenticated;
grant execute on function public.teacher_create_calendar_event(uuid,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.admin_list_academic_setup() to authenticated;
grant execute on function public.admin_upsert_classroom(uuid,text,text) to authenticated;
grant execute on function public.admin_archive_classroom(uuid) to authenticated;
grant execute on function public.admin_upsert_subject(uuid,text,text) to authenticated;
grant execute on function public.admin_upsert_term(uuid,text,date,date,boolean) to authenticated;
grant execute on function public.teacher_get_class_report(uuid) to authenticated;

drop policy if exists "Students upload task submissions" on storage.objects;
create policy "Students upload task submissions"
on storage.objects for insert to authenticated
with check (
  bucket_id='academic-attachments'
  and (select public.has_role(auth.uid(),'student'::public.app_role))
  and split_part(name,'/',1)=(auth.uid())::text
  and split_part(name,'/',2)='submissions'
);

drop policy if exists "Students read task submissions" on storage.objects;
create policy "Students read task submissions"
on storage.objects for select to authenticated
using (
  bucket_id='academic-attachments'
  and (
    split_part(name,'/',1)=(auth.uid())::text
    or exists(select 1 from public.task_submissions ts where ts.attachment_path=objects.name and (
      ts.student_id=(select s.id from public.students s where s.user_id=auth.uid() limit 1)
      or exists(select 1 from public.tasks t where t.id=ts.task_id and t.teacher_id=auth.uid())
    ))
  )
);

drop policy if exists "Students delete task submissions" on storage.objects;
create policy "Students delete task submissions"
on storage.objects for delete to authenticated
using (
  bucket_id='academic-attachments'
  and split_part(name,'/',1)=(auth.uid())::text
  and split_part(name,'/',2)='submissions'
);

drop policy if exists "Teachers read task submission files" on storage.objects;
create policy "Teachers read task submission files"
on storage.objects for select to authenticated
using (
  bucket_id='academic-attachments'
  and exists (
    select 1 from public.task_submissions ts
    join public.tasks t on t.id=ts.task_id
    where ts.attachment_path=objects.name and t.teacher_id=auth.uid()
  )
);
