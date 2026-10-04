-- Fix teacher communication and calendar RPCs.
-- Keep all writes tenant-scoped and limited to classrooms owned by the teacher.

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
set search_path=''
as $function$
declare
  result_row public.announcements;
  inst uuid;
  classroom_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
  end if;

  if nullif(trim(_classroom),'') is null then
    raise exception 'Selecione uma turma.';
  end if;
  if nullif(trim(_title),'') is null then
    raise exception 'Informe o título do aviso.';
  end if;
  if nullif(trim(_content),'') is null then
    raise exception 'Escreva o conteúdo do aviso.';
  end if;

  select c.id
    into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct
    on ct.classroom_id=c.id
   and ct.user_id=auth.uid()
  where c.id::text=trim(_classroom)
    and c.institution_id=inst
    and c.status='active'
  limit 1;

  if classroom_id is null then
    select c.id
      into classroom_id
    from public.classrooms c
    join public.classroom_teachers ct
      on ct.classroom_id=c.id
     and ct.user_id=auth.uid()
    where lower(c.name)=lower(trim(_classroom))
      and c.institution_id=inst
      and c.status='active'
    order by c.created_at desc
    limit 1;
  end if;

  if classroom_id is null then
    raise exception 'A turma selecionada não pertence a você.';
  end if;

  insert into public.announcements(
    teacher_id,classroom,title,content,
    attachment_path,attachment_name,attachment_size,attachment_type,
    institution_id,classroom_id
  )
  values(
    auth.uid(),
    (select c.name from public.classrooms c where c.id=classroom_id),
    trim(_title),
    trim(_content),
    nullif(trim(_attachment_path),''),
    nullif(trim(_attachment_name),''),
    _attachment_size,
    nullif(trim(_attachment_type),''),
    inst,
    classroom_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),
    classroom_id,
    'announcement',
    trim(_title),
    trim(_content),
    '/aluno/avisos'
  );

  return result_row;
end;
$function$;

create or replace function public.teacher_list_announcements()
returns setof public.announcements
language sql
stable
security definer
set search_path=''
as $function$
  select a.*
  from public.announcements a
  where a.teacher_id=auth.uid()
    and a.institution_id=sina_private.current_institution('teacher'::public.app_role)
  order by a.created_at desc
  limit 100;
$function$;

create or replace function public.teacher_create_calendar_event(
  _classroom_id uuid,
  _title text,
  _description text,
  _start_at timestamptz,
  _end_at timestamptz,
  _event_type text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  event_id uuid;
  inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;

  inst := sina_private.current_institution('teacher'::public.app_role);
  if inst is null then
    raise exception 'Professor sem instituição ativa.';
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

  if _classroom_id is not null and not exists (
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

  insert into public.calendar_events(
    institution_id,created_by,classroom_id,title,description,start_at,end_at,event_type,status
  )
  values(
    inst,auth.uid(),_classroom_id,trim(_title),coalesce(trim(_description),''),
    _start_at,_end_at,coalesce(nullif(trim(_event_type),''),'aula'),'scheduled'
  )
  returning id into event_id;

  return event_id;
end;
$function$;

create or replace function public.teacher_list_calendar(
  _from timestamptz,
  _to timestamptz
)
returns table(
  id uuid,
  classroom_id uuid,
  classroom_name text,
  title text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  event_type text,
  status text
)
language sql
stable
security definer
set search_path=''
as $function$
  select
    e.id,
    e.classroom_id,
    c.name,
    e.title,
    e.description,
    e.start_at,
    e.end_at,
    e.event_type,
    e.status
  from public.calendar_events e
  left join public.classrooms c on c.id=e.classroom_id
  where e.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and e.created_by=auth.uid()
    and e.status='scheduled'
    and (_from is null or e.start_at >= _from)
    and (_to is null or e.start_at <= _to)
  order by e.start_at asc
  limit 200;
$function$;

revoke all on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_list_announcements() from public,anon;
revoke all on function public.teacher_create_calendar_event(uuid,text,text,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.teacher_list_calendar(timestamptz,timestamptz) from public,anon;

grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_list_announcements() to authenticated;
grant execute on function public.teacher_create_calendar_event(uuid,text,text,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.teacher_list_calendar(timestamptz,timestamptz) to authenticated;