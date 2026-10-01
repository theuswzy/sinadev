
-- Remove the old one-student-per-user uniqueness so the same account can belong
-- to more than one institution without overwriting another school's profile.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='public.students'::regclass
      and contype='u'
      and conkey = array[(select attnum from pg_attribute where attrelid='public.students'::regclass and attname='user_id' and not attisdropped)]
  loop
    execute format('alter table public.students drop constraint if exists %I',r.conname);
  end loop;

  for r in
    select indexrelid::regclass::text as index_name
    from pg_index
    where indrelid='public.students'::regclass
      and indisunique
      and indkey = array[(select attnum from pg_attribute where attrelid='public.students'::regclass and attname='user_id' and not attisdropped)]
  loop
    execute format('drop index if exists %s',r.index_name);
  end loop;
end;
$$;

create or replace function public.ensure_student_profile_for_user(_user_id uuid,_institution_id uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare display_name text;
begin
  if _institution_id is null then raise exception 'Instituição obrigatória para criar o perfil do aluno.'; end if;

  if exists(select 1 from public.students where user_id=_user_id and institution_id=_institution_id) then
    return true;
  end if;

  select coalesce(
    nullif(p.display_name,''),
    nullif(au.raw_user_meta_data->>'display_name',''),
    split_part(coalesce(au.email,''),'@',1)
  ) into display_name
  from auth.users au
  left join public.profiles p on p.user_id=au.id
  where au.id=_user_id;

  insert into public.students(user_id,full_name,enrollment,classroom,teacher_id,institution_id)
  values(_user_id,coalesce(display_name,'Aluno'),'','','',_institution_id);

  return true;
end;
$$;

-- Fix the empty teacher_id literal above for strict UUID schemas.
create or replace function public.ensure_student_profile_for_user(_user_id uuid,_institution_id uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare display_name text;
begin
  if _institution_id is null then raise exception 'Instituição obrigatória para criar o perfil do aluno.'; end if;
  if exists(select 1 from public.students where user_id=_user_id and institution_id=_institution_id) then return true; end if;

  select coalesce(
    nullif(p.display_name,''),
    nullif(au.raw_user_meta_data->>'display_name',''),
    split_part(coalesce(au.email,''),'@','1')
  ) into display_name
  from auth.users au
  left join public.profiles p on p.user_id=au.id
  where au.id=_user_id;

  insert into public.students(user_id,full_name,enrollment,classroom,teacher_id,institution_id)
  values(_user_id,coalesce(display_name,'Aluno'),'','',null,_institution_id);
  return true;
end;
$$;

create or replace function public.ensure_student_profile()
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare uid uuid:=auth.uid(); inst uuid;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  inst:=sina_private.current_institution('student'::public.app_role);
  if inst is null then raise exception 'Aluno sem instituição ativa.'; end if;
  return public.ensure_student_profile_for_user(uid,inst);
end;
$$;

create or replace function public.student_get_profile()
returns setof public.students
language sql stable security definer set search_path to ''
as $$
  select s.*
  from public.students s
  where s.user_id=auth.uid()
    and s.institution_id=sina_private.current_institution('student'::public.app_role)
  order by s.updated_at desc
  limit 1;
$$;

create or replace function public.student_update_profile(_full_name text,_avatar_url text default null)
returns public.students
language plpgsql security definer set search_path to ''
as $$
declare result_row public.students; inst uuid;
begin
  inst:=sina_private.current_institution('student'::public.app_role);
  if inst is null then raise exception 'Aluno sem instituição ativa.'; end if;
  update public.students
  set full_name=trim(_full_name),avatar_url=nullif(trim(_avatar_url),''),
      updated_at=now()
  where user_id=auth.uid() and institution_id=inst
  returning * into result_row;
  if result_row.id is null then
    perform public.ensure_student_profile();
    update public.students
    set full_name=trim(_full_name),avatar_url=nullif(trim(_avatar_url),''),
        updated_at=now()
    where user_id=auth.uid() and institution_id=inst
    returning * into result_row;
  end if;
  return result_row;
end;
$$;

create or replace function public.student_set_task_completed(_task_id uuid,_completed boolean)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare student_record public.students;
begin
  select s.* into student_record
  from public.students s
  where s.user_id=auth.uid()
    and s.institution_id=sina_private.current_institution('student'::public.app_role)
  limit 1;
  if student_record.id is null then raise exception 'Perfil de aluno não encontrado.'; end if;

  if not exists(
    select 1 from public.tasks t
    where t.id=_task_id and t.institution_id=student_record.institution_id
      and t.teacher_id=student_record.teacher_id
      and t.classroom=student_record.classroom
      and student_record.teacher_id is not null
  ) then raise exception 'Tarefa não encontrada para este aluno.'; end if;

  insert into public.task_completions(task_id,student_id,completed,updated_at)
  values(_task_id,student_record.id,_completed,now())
  on conflict(task_id,student_id) do update set completed=excluded.completed,updated_at=now();
  return true;
end;
$$;

-- SINA: final functional hardening for academic workflows
-- Keeps all academic reads/writes scoped to the active institution and assigned class.

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
  admin_inst uuid;
  old_role public.app_role;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso reservado a administradores.';
  end if;
  admin_inst := sina_private.current_institution('admin'::public.app_role);
  if admin_inst is null then raise exception 'Administrador sem instituição ativa.'; end if;
  if _decision not in ('approved','rejected') then raise exception 'Decisão inválida.'; end if;

  select * into req from public.account_role_requests where id=_request_id for update;
  if req.id is null then return false; end if;
  if req.status <> 'pending' then raise exception 'Esta solicitação já foi processada.'; end if;

  select * into school
  from public.school_directory
  where id=req.school_directory_id and status='active';
  if school.id is null then raise exception 'A escola selecionada não está mais disponível no catálogo.'; end if;

  inst := coalesce(req.institution_id,school.institution_id);
  if inst is null then raise exception 'Esta escola ainda não está vinculada a uma instituição SINA.'; end if;
  if inst <> admin_inst then raise exception 'Esta solicitação pertence a outra instituição.'; end if;

  if _decision='rejected' then
    update public.account_role_requests
    set institution_id=admin_inst,status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
        review_note=nullif(trim(_note),''),updated_at=now()
    where id=_request_id;
    update public.profiles set status='pending',updated_at=now() where user_id=req.user_id;
    return true;
  end if;

  if _approved_role not in ('student','teacher') then raise exception 'Selecione uma função válida para aprovar.'; end if;

  select m.role into old_role
  from public.institution_memberships m
  where m.user_id=req.user_id and m.institution_id=admin_inst
    and m.role in ('student','teacher') and m.status='active'
  order by case when m.role='teacher' then 0 else 1 end
  limit 1;

  delete from public.institution_memberships
  where user_id=req.user_id and institution_id=admin_inst and role in ('student','teacher');

  insert into public.institution_memberships(institution_id,user_id,role,status)
  values(admin_inst,req.user_id,_approved_role::public.app_role,'active');

  insert into public.user_roles(user_id,role)
  values(req.user_id,_approved_role::public.app_role)
  on conflict(user_id,role) do nothing;

  if old_role is not null and old_role::text <> _approved_role
     and not exists(
       select 1 from public.institution_memberships
       where user_id=req.user_id and role=old_role and status='active'
     ) then
    delete from public.user_roles where user_id=req.user_id and role=old_role;
  end if;

  update public.account_role_requests
  set institution_id=admin_inst,status='approved',reviewed_by=auth.uid(),reviewed_at=now(),
      review_note=nullif(trim(_note),''),updated_at=now()
  where id=_request_id;
  update public.profiles set status='active',updated_at=now() where user_id=req.user_id;
  update public.school_directory set institution_id=admin_inst,updated_at=now() where id=school.id;

  if _approved_role='student' then
    perform public.ensure_student_profile_for_user(req.user_id,admin_inst);
  end if;
  return true;
end;
$$;

create or replace function public.account_resubmit_role_request(_requested_role text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid:=auth.uid();
  v_school uuid;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if _requested_role not in ('student','teacher') then raise exception 'Função solicitada inválida.'; end if;

  if exists(
    select 1 from public.institution_memberships m
    where m.user_id=uid and m.status='active'
      and m.role in ('admin','teacher','student')
  ) then
    return false;
  end if;

  select school_directory_id into v_school
  from public.account_role_requests
  where user_id=uid
  order by created_at desc
  limit 1;

  update public.account_role_requests
  set status='cancelled',updated_at=now()
  where user_id=uid and status='pending';

  insert into public.account_role_requests(user_id,requested_role,status,school_directory_id)
  values(uid,_requested_role::public.app_role,'pending',v_school);

  update public.profiles set status='pending',updated_at=now() where user_id=uid;

  delete from public.user_roles
  where user_id=uid
    and role in ('student','teacher')
    and not exists(
      select 1 from public.institution_memberships m
      where m.user_id=uid and m.role=public.user_roles.role and m.status='active'
    );

  return true;
end;
$$;

drop function if exists public.teacher_link_roster_student(uuid,text,text);

create or replace function public.teacher_link_roster_student(
  _student_id uuid,
  _enrollment text,
  _classroom text
)
returns setof public.students
language plpgsql
security definer
set search_path to ''
as $$
declare
  inst uuid;
  v_classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;

  select c.id into v_classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active'
    and lower(c.name)=lower(trim(_classroom))
  limit 1;
  if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;
  if nullif(trim(_enrollment),'') is null then raise exception 'Informe a matrícula.'; end if;

  update public.students
  set enrollment=trim(_enrollment),classroom=trim(_classroom),classroom_id=v_classroom_id,
      teacher_id=auth.uid(),institution_id=inst,updated_at=now()
  where id=_student_id and institution_id=inst;

  if not found then raise exception 'Aluno não encontrado nesta instituição.'; end if;
  return query select * from public.students where id=_student_id;
end;
$;

create or replace function public.teacher_list_grades(_student_id uuid)
returns setof public.grades
language sql stable security definer
set search_path to ''
as $$
  select g.*
  from public.grades g
  join public.students s on s.id=g.student_id
  where s.id=_student_id
    and s.teacher_id=auth.uid()
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by g.subject,g.period;
$$;

create or replace function public.student_list_grades()
returns setof public.grades
language sql stable security definer
set search_path to ''
as $$
  select g.*
  from public.grades g
  join public.students s on s.id=g.student_id
  where s.user_id=auth.uid()
    and g.institution_id=s.institution_id
  order by g.subject,g.period;
$$;

create or replace function public.teacher_upsert_assessment_score(
  _assessment_id uuid,_student_id uuid,_score numeric,_feedback text
)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  inst uuid;
  max_score numeric;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  select a.max_score into max_score
  from public.assessments a
  join public.classroom_teachers ct on ct.classroom_id=a.classroom_id and ct.user_id=auth.uid()
  join public.students s on s.id=_student_id and s.classroom_id=a.classroom_id
  where a.id=_assessment_id and a.teacher_id=auth.uid() and a.institution_id=inst;
  if max_score is null then raise exception 'Avaliação ou aluno inválido'; end if;
  if _score is not null and (_score < 0 or _score > max_score) then raise exception 'Nota fora do limite da avaliação'; end if;

  insert into public.assessment_scores(assessment_id,student_id,score,feedback,graded_at,graded_by,submitted_at,updated_at)
  values(_assessment_id,_student_id,_score,_feedback,now(),auth.uid(),now(),now())
  on conflict(assessment_id,student_id) do update
  set score=excluded.score,feedback=excluded.feedback,graded_at=now(),graded_by=auth.uid(),updated_at=now();
  return true;
end;
$$;

create or replace function public.teacher_create_assessment(
  _classroom_id uuid,_subject_id uuid,_term_id uuid,_title text,_type text,
  _weight numeric,_max_score numeric,_due_at timestamptz
)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare inst uuid; assessment_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Instituição não encontrada'; end if;
  if not exists(
    select 1 from public.classroom_teachers ct
    join public.classrooms c on c.id=ct.classroom_id
    where ct.classroom_id=_classroom_id and ct.user_id=auth.uid()
      and c.institution_id=inst and c.status='active'
  ) then raise exception 'Você não possui acesso a esta turma'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da avaliação'; end if;
  if _weight <= 0 or _weight > 100 or _max_score <= 0 or _max_score > 100 then raise exception 'Valores da avaliação inválidos'; end if;
  if _subject_id is not null and not exists(select 1 from public.subjects su where su.id=_subject_id and su.institution_id=inst and su.status='active') then raise exception 'Disciplina inválida'; end if;
  if _term_id is not null and not exists(select 1 from public.academic_terms t where t.id=_term_id and t.institution_id=inst) then raise exception 'Período acadêmico inválido'; end if;
  insert into public.assessments(institution_id,classroom_id,subject_id,term_id,teacher_id,title,assessment_type,weight,max_score,due_at)
  values(inst,_classroom_id,_subject_id,_term_id,auth.uid(),trim(_title),coalesce(nullif(trim(_type),''),'prova'),_weight,_max_score,_due_at)
  returning id into assessment_id;
  return assessment_id;
end;
$$;

create or replace function public.student_list_assessments()
returns table(id uuid,title text,assessment_type text,weight numeric,max_score numeric,due_at timestamptz,status text,subject_name text,term_name text,score numeric,feedback text)
language sql stable security definer set search_path to ''
as $$
  select a.id,a.title,a.assessment_type,a.weight,a.max_score,a.due_at,a.status,
         coalesce(su.name,a.title),coalesce(t.name,''),sc.score,sc.feedback
  from public.assessments a
  join public.students st
    on st.classroom_id=a.classroom_id
   and st.user_id=auth.uid()
   and st.institution_id=a.institution_id
  left join public.subjects su on su.id=a.subject_id
  left join public.academic_terms t on t.id=a.term_id
  left join public.assessment_scores sc on sc.assessment_id=a.id and sc.student_id=st.id
  where a.status <> 'draft'
    and a.institution_id=st.institution_id
  order by coalesce(a.due_at,a.created_at) desc;
$$;

create or replace function public.student_submit_task(_task_id uuid,_content text)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare sid uuid; inst uuid; sub_id uuid;
begin
  select id,institution_id into sid,inst from public.students where user_id=auth.uid() limit 1;
  if sid is null then raise exception 'Perfil de aluno não encontrado'; end if;
  if not exists(
    select 1
    from public.tasks t
    join public.students s on s.id=sid
    where t.id=_task_id and t.institution_id=inst
      and t.classroom=s.classroom
      and (t.classroom_id is null or t.classroom_id=s.classroom_id)
      and s.institution_id=inst
  ) then raise exception 'Atividade indisponível'; end if;
  insert into public.task_submissions(task_id,student_id,content,status,submitted_at,updated_at)
  values(_task_id,sid,coalesce(_content,''),'submitted',now(),now())
  on conflict(task_id,student_id) do update
  set content=excluded.content,status='submitted',submitted_at=now(),updated_at=now();
  select id into sub_id from public.task_submissions where task_id=_task_id and student_id=sid;
  insert into public.task_completions(task_id,student_id,completed,updated_at)
  values(_task_id,sid,true,now())
  on conflict(task_id,student_id)
  do update set completed=true,updated_at=now();
  return sub_id;
end;
$;

create or replace function public.teacher_list_task_submissions(_task_id uuid)
returns table(id uuid,task_id uuid,student_id uuid,student_name text,enrollment text,content text,status text,submitted_at timestamptz,score numeric,feedback text)
language sql stable security definer set search_path to ''
as $$
  select ts.id,ts.task_id,ts.student_id,s.full_name,s.enrollment,ts.content,ts.status,ts.submitted_at,ts.score,ts.feedback
  from public.task_submissions ts
  join public.students s on s.id=ts.student_id
  join public.tasks t on t.id=ts.task_id
  join public.classroom_teachers ct on ct.classroom_id=t.classroom_id and ct.user_id=auth.uid()
  where t.id=_task_id and t.teacher_id=auth.uid()
    and t.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and s.institution_id=t.institution_id
  order by s.full_name;
$$;

create or replace function public.teacher_grade_submission(_submission_id uuid,_score numeric,_feedback text)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare max_score numeric; inst uuid;
begin
  inst:=sina_private.current_institution('teacher'::public.app_role);
  select a.max_score into max_score
  from public.task_submissions ts
  join public.tasks t on t.id=ts.task_id
  left join public.assessments a on false
  where ts.id=_submission_id and t.teacher_id=auth.uid() and t.institution_id=inst;
  if not found then raise exception 'Entrega não pertence às suas turmas'; end if;
  update public.task_submissions
  set score=_score,feedback=_feedback,status='graded',graded_at=now(),updated_at=now()
  where id=_submission_id;
  return true;
end;
$$;

create or replace function public.teacher_create_calendar_event(
  _classroom_id uuid,_title text,_description text,_start_at timestamptz,_end_at timestamptz,_event_type text
)
returns uuid
language plpgsql security definer set search_path to ''
as $$
declare inst uuid; event_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Instituição não encontrada'; end if;
  if _classroom_id is not null and not exists(
    select 1 from public.classroom_teachers ct
    join public.classrooms c on c.id=ct.classroom_id
    where ct.classroom_id=_classroom_id and ct.user_id=auth.uid()
      and c.institution_id=inst and c.status='active'
  ) then raise exception 'Turma inválida'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do evento'; end if;
  if _end_at is not null and _end_at < _start_at then raise exception 'O fim do evento não pode ser antes do início'; end if;
  if _event_type not in ('aula','prova','trabalho','evento','recesso','outro') then raise exception 'Tipo de evento inválido'; end if;
  insert into public.calendar_events(institution_id,classroom_id,created_by,title,description,start_at,end_at,event_type)
  values(inst,_classroom_id,auth.uid(),trim(_title),coalesce(_description,''),_start_at,_end_at,_event_type)
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.teacher_get_class_report(_classroom_id uuid)
returns table(student_id uuid,student_name text,enrollment text,attendance_percent numeric,grade_average numeric,assessment_count bigint)
language sql stable security definer set search_path to ''
as $$
  select s.id,s.full_name,s.enrollment,
    coalesce(round((count(ar.id) filter (where ar.status in ('present','late'))::numeric / nullif(count(ar.id),0))*100,1), s.attendance),
    coalesce(round(avg(g.score),2),0),
    (select count(*) from public.assessment_scores sc
      join public.assessments a on a.id=sc.assessment_id
      where sc.student_id=s.id and a.classroom_id=_classroom_id
        and a.institution_id=s.institution_id)
  from public.students s
  left join public.attendance_records ar on ar.student_id=s.id and ar.classroom_id=_classroom_id and ar.institution_id=s.institution_id
  left join public.grades g on g.student_id=s.id and g.institution_id=s.institution_id
  where s.teacher_id=auth.uid()
    and s.classroom_id=_classroom_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  group by s.id,s.full_name,s.enrollment,s.attendance
  order by s.full_name;
$$;

-- Fix task listing so attachment metadata is not lost.
drop function if exists public.student_list_tasks();
create or replace function public.student_list_tasks()
returns table (
  id uuid,classroom text,subject text,title text,description text,due_at timestamptz,
  attachment_path text,attachment_name text,attachment_size bigint,attachment_type text,
  created_at timestamptz,completed boolean
)
language sql stable security definer set search_path to ''
as $$
  select t.id,t.classroom,t.subject,t.title,t.description,t.due_at,
         t.attachment_path,t.attachment_name,t.attachment_size,t.attachment_type,
         t.created_at,coalesce(tc.completed,false)
  from public.tasks t
  join public.students s
    on s.user_id=auth.uid()
   and s.institution_id=t.institution_id
   and s.teacher_id=t.teacher_id
   and s.classroom=t.classroom
  left join public.task_completions tc on tc.task_id=t.id and tc.student_id=s.id
  order by (t.due_at is null),t.due_at,t.created_at desc
  limit 50;
$$;

revoke all on function public.teacher_list_grades(uuid) from public,anon;
revoke all on function public.student_list_grades() from public,anon;
revoke all on function public.teacher_link_roster_student(uuid,text,text) from public,anon;
grant execute on function public.teacher_list_grades(uuid) to authenticated;
grant execute on function public.student_list_grades() to authenticated;
grant execute on function public.teacher_link_roster_student(uuid,text,text) to authenticated;

revoke all on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) from public,anon;
revoke all on function public.teacher_create_assessment(uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) from public,anon;
revoke all on function public.student_list_assessments() from public,anon;
revoke all on function public.student_submit_task(uuid,text) from public,anon;
revoke all on function public.teacher_list_task_submissions(uuid) from public,anon;
revoke all on function public.teacher_grade_submission(uuid,numeric,text) from public,anon;
revoke all on function public.teacher_create_calendar_event(uuid,text,text,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.teacher_get_class_report(uuid) from public,anon;
grant execute on function public.teacher_upsert_assessment_score(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.teacher_create_assessment(uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) to authenticated;
grant execute on function public.student_list_assessments() to authenticated;
grant execute on function public.student_submit_task(uuid,text) to authenticated;
grant execute on function public.teacher_list_task_submissions(uuid) to authenticated;
grant execute on function public.teacher_grade_submission(uuid,numeric,text) to authenticated;
grant execute on function public.teacher_create_calendar_event(uuid,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.teacher_get_class_report(uuid) to authenticated;
