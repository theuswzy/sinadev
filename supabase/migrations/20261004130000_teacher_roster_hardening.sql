-- SINA: complete teacher roster access and class-scoped academic permissions.
-- A student belongs to a class; multiple teachers can teach the same class.
-- teacher_id is retained only as legacy/primary-responsible metadata and is not
-- used to decide whether a teacher can work with a student's class.

create or replace function public.teacher_list_institution_students()
returns table(
  id uuid,
  full_name text,
  enrollment text,
  classroom text,
  classroom_id uuid,
  attendance numeric,
  teacher_id uuid,
  class_status text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    s.id,
    s.full_name,
    s.enrollment,
    s.classroom,
    s.classroom_id,
    s.attendance,
    s.teacher_id,
    case
      when s.classroom_id is null then 'sem_turma'
      when exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      ) then 'minha_turma'
      else 'outra_turma'
    end
  from public.students s
  where s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by
    case
      when s.classroom_id is null then 0
      when exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      ) then 1
      else 2
    end,
    lower(s.full_name);
$$;

create or replace function public.teacher_list_roster()
returns table(id uuid, full_name text, enrollment text, classroom text, classroom_id uuid, attendance numeric, teacher_id uuid)
language sql
stable
security definer
set search_path=''
as $$
  select s.id,s.full_name,s.enrollment,s.classroom,s.classroom_id,s.attendance,s.teacher_id
  from public.students s
  where s.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and (
      s.teacher_id=auth.uid()
      or s.teacher_id is null
      or exists (
        select 1
        from public.classroom_teachers ct
        join public.classrooms c on c.id=ct.classroom_id
        where ct.classroom_id=s.classroom_id
          and ct.user_id=auth.uid()
          and c.institution_id=s.institution_id
          and c.status='active'
      )
    )
  order by case when s.classroom_id is null then 0 else 1 end, lower(s.full_name);
$$;

create or replace function public.teacher_link_roster_student(
  _student_id uuid,
  _enrollment text,
  _classroom text
)
returns setof public.students
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
  target_classroom uuid;
  current_classroom uuid;
  current_teacher uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  select c.id into target_classroom
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst
    and c.status='active'
    and lower(c.name)=lower(trim(_classroom))
  limit 1;

  if target_classroom is null then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  if nullif(trim(_enrollment),'') is null then
    raise exception 'Informe a matrícula.';
  end if;

  select s.classroom_id,s.teacher_id
    into current_classroom,current_teacher
  from public.students s
  where s.id=_student_id
    and s.institution_id=inst
  for update;

  if current_classroom is null and current_teacher is null then
    update public.students
    set classroom_id=target_classroom,
        classroom=trim(_classroom),
        enrollment=trim(_enrollment),
        teacher_id=auth.uid(),
        updated_at=now()
    where id=_student_id
      and institution_id=inst;
  else
    if current_classroom is not null
       and current_classroom<>target_classroom
       and not exists (
         select 1
         from public.classroom_teachers ct
         where ct.classroom_id=current_classroom
           and ct.user_id=auth.uid()
       ) then
      raise exception 'Este aluno já está vinculado a outra turma. Solicite a mudança ao administrador.';
    end if;

    update public.students
    set classroom_id=target_classroom,
        classroom=trim(_classroom),
        enrollment=trim(_enrollment),
        teacher_id=coalesce(teacher_id,auth.uid()),
        updated_at=now()
    where id=_student_id
      and institution_id=inst;
  end if;

  if not found then
    raise exception 'Aluno não encontrado nesta instituição.';
  end if;

  return query
  select * from public.students where id=_student_id;
end;
$$;

create or replace function public.teacher_list_grades(_student_id uuid)
returns setof public.grades
language sql
stable
security definer
set search_path=''
as $$
  select g.*
  from public.grades g
  join public.students s on s.id=g.student_id
  where s.id=_student_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and exists (
      select 1
      from public.classroom_teachers ct
      where ct.classroom_id=s.classroom_id
        and ct.user_id=auth.uid()
    )
    and g.institution_id=s.institution_id
  order by g.subject,g.period;
$$;

create or replace function sina_private.list_teacher_grades(_student_id uuid)
returns setof public.grades
language sql
stable
security definer
set search_path=''
as $$
  select g.*
  from public.grades g
  join public.students s on s.id=g.student_id
  where s.id=_student_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and exists (
      select 1
      from public.classroom_teachers ct
      where ct.classroom_id=s.classroom_id
        and ct.user_id=auth.uid()
    )
    and g.institution_id=s.institution_id
  order by g.subject,g.period;
$$;

create or replace function public.teacher_upsert_grade(
  _student_id uuid,
  _subject text,
  _period integer,
  _score numeric,
  _absences integer
)
returns public.grades
language plpgsql
security definer
set search_path=''
as $$
declare
  result_row public.grades;
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if nullif(trim(_subject),'') is null then
    raise exception 'Informe a disciplina.';
  end if;

  if _period < 1 or _period > 4 or _score < 0 or _score > 10 or _absences < 0 then
    raise exception 'Dados da nota inválidos.';
  end if;

  if not exists (
    select 1
    from public.students s
    join public.classroom_teachers ct on ct.classroom_id=s.classroom_id and ct.user_id=auth.uid()
    join public.classrooms c on c.id=s.classroom_id and c.institution_id=inst and c.status='active'
    where s.id=_student_id and s.institution_id=inst
  ) then
    raise exception 'Aluno não pertence a uma turma vinculada a este professor.';
  end if;

  insert into public.grades (student_id,subject,period,score,absences,institution_id)
  values (_student_id,trim(_subject),_period,_score,_absences,inst)
  on conflict (student_id,subject,period)
  do update set
    score=excluded.score,
    absences=excluded.absences,
    institution_id=excluded.institution_id,
    updated_at=now()
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.teacher_get_attendance(_classroom_id uuid,_date date)
returns table(student_id uuid,full_name text,enrollment text,status text,note text)
language sql
stable
security definer
set search_path=''
as $$
  select s.id,s.full_name,s.enrollment,
         coalesce(a.status,'present') as status,
         coalesce(a.note,'') as note
  from public.students s
  join public.classroom_teachers ct
    on ct.classroom_id=s.classroom_id
   and ct.user_id=auth.uid()
  left join public.attendance_records a
    on a.student_id=s.id and a.attendance_date=_date
  where s.classroom_id=_classroom_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by s.full_name;
$$;

create or replace function public.teacher_save_attendance(
  _classroom_id uuid,
  _date date,
  _rows jsonb
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
  teacher uuid:=auth.uid();
  item jsonb;
  total integer:=0;
  student uuid;
  stat text;
  note_text text;
begin
  if not public.has_role(teacher,'teacher'::public.app_role) then
    raise exception 'Acesso restrito ao professor';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if not exists(
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id=ct.classroom_id
    where ct.classroom_id=_classroom_id
      and ct.user_id=teacher
      and c.institution_id=inst
      and c.status='active'
  ) then
    raise exception 'Turma não vinculada ao professor';
  end if;

  for item in select * from jsonb_array_elements(coalesce(_rows,'[]'::jsonb)) loop
    student:=(item->>'student_id')::uuid;
    stat:=coalesce(item->>'status','present');
    note_text:=coalesce(item->>'note','');

    if stat not in ('present','absent','late','excused') then
      raise exception 'Situação de frequência inválida';
    end if;

    if exists(
      select 1
      from public.students s
      where s.id=student
        and s.classroom_id=_classroom_id
        and s.institution_id=inst
    ) then
      insert into public.attendance_records(
        institution_id,classroom_id,student_id,teacher_id,attendance_date,status,note,updated_at
      )
      values(inst,_classroom_id,student,teacher,_date,stat,nullif(note_text,''),now())
      on conflict(student_id,attendance_date)
      do update set
        classroom_id=excluded.classroom_id,
        teacher_id=excluded.teacher_id,
        status=excluded.status,
        note=excluded.note,
        updated_at=now();

      total:=total+1;
    end if;
  end loop;

  return total;
end;
$$;

create or replace function public.teacher_get_class_report(_classroom_id uuid)
returns table(
  student_id uuid,
  student_name text,
  enrollment text,
  attendance_percent numeric,
  grade_average numeric,
  assessment_count bigint
)
language sql
stable
security definer
set search_path=''
as $$
  select
    s.id,
    s.full_name,
    s.enrollment,
    coalesce(
      round(
        (
          count(*) filter (where ar.status in ('present','late'))::numeric
          / nullif(count(ar.id),0)
        )*100,
        1
      ),
      s.attendance
    ),
    coalesce(round(avg(g.score),2),0),
    (
      select count(*)
      from public.assessment_scores sc
      join public.assessments a on a.id=sc.assessment_id
      where sc.student_id=s.id
        and a.classroom_id=_classroom_id
        and a.institution_id=s.institution_id
    )
  from public.students s
  join public.classroom_teachers ct
    on ct.classroom_id=s.classroom_id
   and ct.user_id=auth.uid()
  left join public.attendance_records ar
    on ar.student_id=s.id and ar.classroom_id=_classroom_id
  left join public.grades g
    on g.student_id=s.id and g.institution_id=s.institution_id
  where s.classroom_id=_classroom_id
    and s.institution_id=sina_private.current_institution('teacher'::public.app_role)
  group by s.id,s.full_name,s.enrollment,s.attendance
  order by s.full_name;
$$;

-- Do not let one teacher silently replace another teacher's subject assignment.
create or replace function public.teacher_assign_subject_to_class(
  _subject_id uuid,
  _classroom_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  inst uuid;
  row_id uuid;
  assigned_teacher uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst:=sina_private.current_institution('teacher'::public.app_role);

  if not exists(
    select 1 from public.subjects
    where id=_subject_id and institution_id=inst and status='active'
  ) then
    raise exception 'Disciplina indisponível nesta instituição.';
  end if;

  if not exists(
    select 1
    from public.classrooms c
    join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
    where c.id=_classroom_id and c.institution_id=inst and c.status='active'
  ) then
    raise exception 'A turma não pertence a você.';
  end if;

  select cs.teacher_id into assigned_teacher
  from public.classroom_subjects cs
  where cs.classroom_id=_classroom_id
    and cs.subject_id=_subject_id
    and cs.institution_id=inst;

  if assigned_teacher is not null and assigned_teacher<>auth.uid() then
    raise exception 'Esta disciplina já está atribuída a outro professor nesta turma.';
  end if;

  insert into public.classroom_subjects(institution_id,classroom_id,subject_id,teacher_id)
  values(inst,_classroom_id,_subject_id,auth.uid())
  on conflict(classroom_id,subject_id)
  do update set teacher_id=auth.uid()
  returning id into row_id;

  return row_id;
end;
$$;

revoke all on function public.teacher_list_institution_students() from public,anon;
grant execute on function public.teacher_list_institution_students() to authenticated;
