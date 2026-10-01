-- Teacher workspace: disciplines and publishing are first-class workflows.
alter table public.subjects add column if not exists created_by uuid references auth.users(id);

create or replace function public.teacher_list_subjects()
returns table(id uuid,name text,code text,status text,created_by uuid)
language sql stable security definer set search_path=''
as $$
  select s.id,s.name,s.code,s.status,s.created_by
  from public.subjects s
  where s.institution_id=sina_private.current_institution('teacher'::public.app_role)
    and s.status='active'
  order by s.name;
$$;

create or replace function public.teacher_create_subject(_name text,_code text)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; row_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then
    raise exception 'Acesso restrito a professores.';
  end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_name),'') is null then raise exception 'Informe o nome da disciplina.'; end if;
  if exists(select 1 from public.subjects where institution_id=inst and lower(name)=lower(trim(_name)) and status='active') then
    raise exception 'Já existe uma disciplina com esse nome nesta instituição.';
  end if;
  insert into public.subjects(institution_id,name,code,status,created_by)
  values(inst,trim(_name),nullif(trim(_code),''),'active',auth.uid())
  returning id into row_id;
  return row_id;
end;
$$;

create or replace function public.teacher_update_subject(_id uuid,_name text,_code text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  update public.subjects
  set name=trim(_name),code=nullif(trim(_code),''),updated_at=now()
  where id=_id and institution_id=inst and created_by=auth.uid() and status='active';
  if not found then raise exception 'Disciplina não encontrada ou não pertence a você.'; end if;
  return true;
end;
$$;

create or replace function public.teacher_archive_subject(_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  update public.subjects set status='archived',updated_at=now()
  where id=_id and institution_id=inst and created_by=auth.uid() and status='active';
  return found;
end;
$$;

create or replace function public.teacher_create_task(
  _classroom text,_subject text,_title text,_description text,_due_at timestamptz
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; classroom_id uuid; task_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active' and lower(c.name)=lower(trim(_classroom))
  limit 1;
  if classroom_id is null then raise exception 'A turma não pertence a você.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;
  insert into public.tasks(institution_id,teacher_id,classroom_id,classroom,subject,title,description,due_at)
  values(inst,auth.uid(),classroom_id,trim(_classroom),coalesce(nullif(trim(_subject),''),'Geral'),trim(_title),coalesce(_description,''),_due_at)
  returning id into task_id;
  perform sina_private.create_classroom_notifications(
    classroom_id,
    'task',
    'Nova atividade: '||trim(_title),
    coalesce(nullif(trim(_description),''),'Uma nova atividade foi publicada.'),
    '/aluno/tarefas'
  );
  return task_id;
end;
$$;

create or replace function public.teacher_create_announcement(
  _classroom text,_title text,_content text
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare inst uuid; classroom_id uuid; announcement_id uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  select c.id into classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=inst and c.status='active' and lower(c.name)=lower(trim(_classroom))
  limit 1;
  if classroom_id is null then raise exception 'A turma não pertence a você.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  insert into public.announcements(institution_id,teacher_id,classroom_id,classroom,title,content)
  values(inst,auth.uid(),classroom_id,trim(_classroom),trim(_title),coalesce(_content,''))
  returning id into announcement_id;
  perform sina_private.create_classroom_notifications(
    classroom_id,
    'announcement',
    trim(_title),
    coalesce(nullif(trim(_content),''),'Novo aviso publicado.'),
    '/aluno/avisos'
  );
  return announcement_id;
end;
$$;

revoke all on function public.teacher_list_subjects() from public,anon;
revoke all on function public.teacher_create_subject(text,text) from public,anon;
revoke all on function public.teacher_update_subject(uuid,text,text) from public,anon;
revoke all on function public.teacher_archive_subject(uuid) from public,anon;
revoke all on function public.teacher_create_task(text,text,text,text,timestamptz) from public,anon;
revoke all on function public.teacher_create_announcement(text,text,text) from public,anon;
grant execute on function public.teacher_list_subjects() to authenticated;
grant execute on function public.teacher_create_subject(text,text) to authenticated;
grant execute on function public.teacher_update_subject(uuid,text,text) to authenticated;
grant execute on function public.teacher_archive_subject(uuid) to authenticated;
grant execute on function public.teacher_create_task(text,text,text,text,timestamptz) to authenticated;
grant execute on function public.teacher_create_announcement(text,text,text) to authenticated;
