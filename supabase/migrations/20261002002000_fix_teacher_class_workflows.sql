-- Fix teacher workflows so class ownership comes from classroom_teachers, not student rows.
create or replace function public.teacher_create_assessment(_classroom_id uuid,_subject_id uuid,_term_id uuid,_title text,_type text,_weight numeric,_max_score numeric,_due_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare inst uuid; assessment_id uuid;
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if not exists(select 1 from public.classroom_teachers ct join public.classrooms c on c.id=ct.classroom_id where ct.classroom_id=_classroom_id and ct.user_id=auth.uid() and c.institution_id=inst and c.status='active') then raise exception 'Você não está vinculado a esta turma'; end if;
 if _subject_id is not null and not exists(select 1 from public.subjects su where su.id=_subject_id and su.institution_id=inst and su.status='active') then raise exception 'Disciplina inválida'; end if;
 if _term_id is not null and not exists(select 1 from public.academic_terms t where t.id=_term_id and t.institution_id=inst) then raise exception 'Período acadêmico inválido'; end if;
 if nullif(trim(_title),'') is null then raise exception 'Informe o título da avaliação'; end if;
 insert into public.assessments(institution_id,classroom_id,subject_id,term_id,teacher_id,title,assessment_type,weight,max_score,due_at) values(inst,_classroom_id,_subject_id,_term_id,auth.uid(),trim(_title),coalesce(nullif(trim(_type),''),'prova'),greatest(.01,_weight),greatest(.01,_max_score),_due_at) returning id into assessment_id;
 return assessment_id;
end; $$;

create or replace function public.teacher_create_calendar_event(_classroom_id uuid,_title text,_description text,_start_at timestamptz,_end_at timestamptz,_event_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inst uuid; event_id uuid;
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if _classroom_id is not null and not exists(select 1 from public.classroom_teachers ct join public.classrooms c on c.id=ct.classroom_id where ct.classroom_id=_classroom_id and ct.user_id=auth.uid() and c.institution_id=inst and c.status='active') then raise exception 'Turma inválida ou não vinculada ao professor'; end if;
 if nullif(trim(_title),'') is null then raise exception 'Informe o título do evento'; end if;
 if _start_at is null then raise exception 'Informe a data do evento'; end if;
 insert into public.calendar_events(institution_id,classroom_id,created_by,title,description,start_at,end_at,event_type) values(inst,_classroom_id,auth.uid(),trim(_title),coalesce(_description,''),_start_at,_end_at,coalesce(nullif(_event_type,''),'aula')) returning id into event_id;
 return event_id;
end; $$;

create or replace function public.teacher_save_attendance(_classroom_id uuid,_date date,_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare inst uuid; teacher uuid:=auth.uid(); item jsonb; total integer:=0; student uuid; stat text; note_text text;
begin
 if not public.has_role(teacher,'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if not exists(select 1 from public.classroom_teachers ct join public.classrooms c on c.id=ct.classroom_id where ct.classroom_id=_classroom_id and ct.user_id=teacher and c.institution_id=inst and c.status='active') then raise exception 'Turma não vinculada ao professor'; end if;
 for item in select * from jsonb_array_elements(coalesce(_rows,'[]'::jsonb)) loop
  student:=(item->>'student_id')::uuid; stat:=coalesce(item->>'status','present'); note_text:=coalesce(item->>'note','');
  if stat not in ('present','absent','late','excused') then raise exception 'Situação de frequência inválida'; end if;
  if exists(select 1 from public.students s where s.id=student and s.teacher_id=teacher and s.classroom_id=_classroom_id and s.institution_id=inst) then
   insert into public.attendance_records(institution_id,classroom_id,student_id,teacher_id,attendance_date,status,note,updated_at) values(inst,_classroom_id,student,teacher,_date,stat,nullif(note_text,''),now())
   on conflict(student_id,attendance_date) do update set classroom_id=excluded.classroom_id,teacher_id=excluded.teacher_id,status=excluded.status,note=excluded.note,updated_at=now();
   total:=total+1;
  end if;
 end loop;
 return total;
end; $$;