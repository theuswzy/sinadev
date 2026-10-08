-- Teacher assessment management: update and delete, scoped to the active institution and the owning teacher.

create or replace function public.teacher_update_assessment(
  _id uuid,
  _classroom_id uuid,
  _subject_id uuid,
  _term_id uuid,
  _title text,
  _type text,
  _weight numeric,
  _max_score numeric,
  _due_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito ao professor';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);

  if nullif(trim(_title),'') is null then
    raise exception 'Informe o título da avaliação';
  end if;

  if _weight is null or _weight <= 0 then
    raise exception 'O peso deve ser maior que zero';
  end if;

  if _max_score is null or _max_score <= 0 then
    raise exception 'A nota máxima deve ser maior que zero';
  end if;

  if not exists (
    select 1
    from public.assessments a
    where a.id = _id
      and a.teacher_id = auth.uid()
      and a.institution_id = inst
  ) then
    raise exception 'Avaliação não encontrada ou sem permissão';
  end if;

  if not exists (
    select 1
    from public.classroom_teachers ct
    join public.classrooms c on c.id = ct.classroom_id
    where ct.classroom_id = _classroom_id
      and ct.user_id = auth.uid()
      and c.institution_id = inst
      and c.status = 'active'
  ) then
    raise exception 'Você não está vinculado a esta turma';
  end if;

  if _subject_id is not null and not exists (
    select 1
    from public.classroom_subjects cs
    join public.subjects su on su.id = cs.subject_id
    where cs.classroom_id = _classroom_id
      and cs.subject_id = _subject_id
      and cs.teacher_id = auth.uid()
      and cs.institution_id = inst
      and su.institution_id = inst
      and su.status = 'active'
  ) then
    raise exception 'Disciplina não está vinculada a esta turma para você';
  end if;

  if _term_id is not null and not exists (
    select 1
    from public.academic_terms t
    where t.id = _term_id
      and t.institution_id = inst
  ) then
    raise exception 'Período acadêmico inválido';
  end if;

  update public.assessments
     set classroom_id = _classroom_id,
         subject_id = _subject_id,
         term_id = _term_id,
         title = trim(_title),
         assessment_type = coalesce(nullif(trim(_type),''),'prova'),
         weight = greatest(.01,_weight),
         max_score = greatest(.01,_max_score),
         due_at = _due_at,
         updated_at = now()
   where id = _id
     and teacher_id = auth.uid()
     and institution_id = inst;

  return true;
end;
$function$;

create or replace function public.teacher_delete_assessment(_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito ao professor';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);

  delete from public.assessments
   where id = _id
     and teacher_id = auth.uid()
     and institution_id = inst;

  if not found then
    raise exception 'Avaliação não encontrada ou sem permissão';
  end if;

  return true;
end;
$function$;

revoke all on function public.teacher_update_assessment(uuid,uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) from public;
revoke all on function public.teacher_delete_assessment(uuid) from public;
grant execute on function public.teacher_update_assessment(uuid,uuid,uuid,uuid,text,text,numeric,numeric,timestamptz) to authenticated;
grant execute on function public.teacher_delete_assessment(uuid) to authenticated;
