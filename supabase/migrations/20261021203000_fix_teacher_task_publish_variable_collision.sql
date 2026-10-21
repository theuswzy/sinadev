-- Fix ambiguous PL/pgSQL variable/column names in task publishing.
-- Keep ID-first matching and legacy name fallback, tenant scoping, and notifications.
create or replace function public.teacher_create_task(
  _classroom text, _subject text, _title text, _description text,
  _due_at timestamptz default null,
  _attachment_path text default null, _attachment_name text default null,
  _attachment_size bigint default null, _attachment_type text default null
)
returns public.tasks
language plpgsql security definer set search_path=''
as $function$
declare
  result_row public.tasks;
  v_inst uuid;
  v_classroom_id uuid;
  v_classroom_name text;
  v_subject_id uuid;
  v_subject_name text;
  v_classroom_candidate uuid;
  v_subject_candidate uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  v_inst:=sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  v_classroom_candidate:=case when trim(_classroom) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_classroom)::uuid else null end;
  select c.id,c.name into v_classroom_id,v_classroom_name
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=v_inst and c.status='active'
    and (c.id=v_classroom_candidate or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id=v_classroom_candidate then 0 else 1 end,c.created_at desc
  limit 1;
  if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  v_subject_candidate:=case when trim(_subject) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_subject)::uuid else null end;
  select s.id,s.name into v_subject_id,v_subject_name
  from public.classroom_subjects cs
  join public.subjects s on s.id=cs.subject_id
  where cs.classroom_id=v_classroom_id
    and cs.institution_id=v_inst
    and cs.teacher_id=auth.uid()
    and s.institution_id=v_inst and s.status='active'
    and (s.id=v_subject_candidate or lower(s.name)=lower(trim(_subject)))
  order by case when s.id=v_subject_candidate then 0 else 1 end,s.name
  limit 1;
  if v_subject_id is null then raise exception 'A disciplina não está vinculada a esta turma para você.'; end if;

  insert into public.tasks(
    teacher_id,classroom,subject,title,description,due_at,
    attachment_path,attachment_name,attachment_size,attachment_type,
    institution_id,classroom_id,subject_id
  ) values (
    auth.uid(),v_classroom_name,v_subject_name,trim(_title),coalesce(_description,''),
    _due_at,nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),v_inst,v_classroom_id,v_subject_id
  ) returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),v_classroom_id,'task','Nova atividade: '||trim(_title),
    coalesce(nullif(trim(_description),''),'Uma nova atividade foi publicada.'),
    '/aluno/tarefas'
  );
  return result_row;
end;
$function$;

revoke all on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
