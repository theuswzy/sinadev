-- Teacher communication management: list, edit and delete own announcements/tasks.

create or replace function public.teacher_list_announcements()
returns setof public.announcements
language sql
security definer
set search_path to ''
as $function$
  select a.*
  from public.announcements a
  where a.teacher_id = auth.uid()
  order by a.created_at desc
  limit 100;
$function$;

create or replace function public.teacher_list_tasks()
returns setof public.tasks
language sql
security definer
set search_path to ''
as $function$
  select t.*
  from public.tasks t
  where t.teacher_id = auth.uid()
  order by t.created_at desc
  limit 100;
$function$;

create or replace function public.teacher_update_announcement(
  _id uuid,
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
as $function$
declare result_row public.announcements;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  if nullif(trim(_classroom), '') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_title), '') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content), '') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;
  if not exists (
    select 1 from public.students where teacher_id = auth.uid() and classroom = trim(_classroom)
  ) then raise exception 'A turma selecionada não pertence a você.'; end if;

  update public.announcements
     set classroom = trim(_classroom),
         title = trim(_title),
         content = trim(_content),
         attachment_path = nullif(trim(_attachment_path), ''),
         attachment_name = nullif(trim(_attachment_name), ''),
         attachment_size = _attachment_size,
         attachment_type = nullif(trim(_attachment_type), ''),
         updated_at = now()
   where id = _id and teacher_id = auth.uid()
  returning * into result_row;

  if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
  return result_row;
end;
$function$;

create or replace function public.teacher_delete_announcement(_id uuid)
returns public.announcements
language plpgsql
security definer
set search_path to ''
as $function$
declare result_row public.announcements;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  delete from public.announcements
  where id = _id and teacher_id = auth.uid()
  returning * into result_row;

  if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
  return result_row;
end;
$function$;

create or replace function public.teacher_update_task(
  _id uuid,
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
as $function$
declare result_row public.tasks;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;
  if nullif(trim(_classroom), '') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject), '') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title), '') is null then raise exception 'Informe o título da atividade.'; end if;
  if not exists (
    select 1 from public.students where teacher_id = auth.uid() and classroom = trim(_classroom)
  ) then raise exception 'A turma selecionada não pertence a você.'; end if;

  update public.tasks
     set classroom = trim(_classroom),
         subject = trim(_subject),
         title = trim(_title),
         description = coalesce(trim(_description), ''),
         due_at = _due_at,
         attachment_path = nullif(trim(_attachment_path), ''),
         attachment_name = nullif(trim(_attachment_name), ''),
         attachment_size = _attachment_size,
         attachment_type = nullif(trim(_attachment_type), ''),
         updated_at = now()
   where id = _id and teacher_id = auth.uid()
  returning * into result_row;

  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$function$;

create or replace function public.teacher_delete_task(_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path to ''
as $function$
declare result_row public.tasks;
begin
  if not public.has_role(auth.uid(), 'teacher'::public.app_role) then
    raise exception 'Acesso reservado a professores autorizados.';
  end if;

  delete from public.tasks
  where id = _id and teacher_id = auth.uid()
  returning * into result_row;

  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$function$;

grant execute on function public.teacher_list_announcements() to authenticated;
grant execute on function public.teacher_list_tasks() to authenticated;
grant execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_delete_announcement(uuid) to authenticated;
grant execute on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_delete_task(uuid) to authenticated;
