-- Professor: edição e exclusão segura de eventos da agenda.
-- A escrita continua encapsulada em funções SECURITY DEFINER e limitada
-- ao autor do evento + instituição ativa.

create or replace function public.teacher_update_calendar_event(
  _id uuid,
  _classroom_id uuid,
  _title text,
  _description text,
  _start_at timestamptz,
  _end_at timestamptz,
  _event_type text
)
returns public.calendar_events
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inst uuid;
  result_row public.calendar_events;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  if _id is null then
    raise exception 'Evento inválido.';
  end if;

  if nullif(trim(_title),'') is null then
    raise exception 'Informe o título do evento.';
  end if;

  if _start_at is null then
    raise exception 'Informe a data e hora do evento.';
  end if;

  if _end_at is not null and _end_at < _start_at then
    raise exception 'O fim do evento não pode ser anterior ao início.';
  end if;

  if _classroom_id is not null and not exists(
    select 1
    from public.classrooms c
    join public.classroom_teachers ct
      on ct.classroom_id=c.id
     and ct.user_id=auth.uid()
    where c.id=_classroom_id
      and c.institution_id=inst
      and c.status='active'
  ) then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  update public.calendar_events
  set classroom_id=_classroom_id,
      title=trim(_title),
      description=coalesce(trim(_description),''),
      start_at=_start_at,
      end_at=_end_at,
      event_type=coalesce(nullif(trim(_event_type),''),'aula'),
      updated_at=now()
  where id=_id
    and institution_id=inst
    and created_by=auth.uid()
    and status='scheduled'
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Evento não encontrado ou sem permissão para editar.';
  end if;

  return result_row;
end;
$function$;

create or replace function public.teacher_delete_calendar_event(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inst uuid;
  affected integer;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  update public.calendar_events
  set status='cancelled',
      updated_at=now()
  where id=_id
    and institution_id=inst
    and created_by=auth.uid()
    and status='scheduled';

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'Evento não encontrado ou sem permissão para excluir.';
  end if;

  return true;
end;
$function$;
