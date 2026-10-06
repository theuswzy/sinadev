-- SINA: harden teacher publishing RPCs to accept canonical IDs from the UI.
-- Keep backwards compatibility with legacy callers that still send names.
-- Also scope task subjects to the teacher's actual classroom assignment.

create or replace function public.teacher_create_task(
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
language plpgsql security definer set search_path=''
as $$
declare
  result_row public.tasks;
  v_inst uuid;
  v_classroom_id uuid;
  v_subject_id uuid;
  v_classroom_candidate uuid;
  v_subject_candidate uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  v_inst := sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  v_classroom_candidate := case when trim(_classroom) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_classroom)::uuid else null end;
  select c.id into v_classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=v_inst and c.status='active'
    and (c.id=v_classroom_candidate or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id=v_classroom_candidate then 0 else 1 end
  limit 1;
  if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  v_subject_candidate := case when trim(_subject) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_subject)::uuid else null end;
  select s.id into v_subject_id
  from public.subjects s
  where s.institution_id=v_inst and s.status='active'
    and (s.id=v_subject_candidate or lower(s.name)=lower(trim(_subject)))
  order by case when s.id=v_subject_candidate then 0 else 1 end
  limit 1;
  if v_subject_id is null then raise exception 'A disciplina não está disponível nesta instituição.'; end if;

  if not exists (
    select 1 from public.classroom_subjects cs
    where cs.classroom_id=v_classroom_id and cs.subject_id=v_subject_id
      and cs.institution_id=v_inst and cs.teacher_id=auth.uid()
  ) then
    raise exception 'A disciplina não está vinculada a esta turma para você.';
  end if;

  insert into public.tasks(
    teacher_id,classroom,subject,title,description,due_at,
    attachment_path,attachment_name,attachment_size,attachment_type,
    institution_id,classroom_id
  )
  values(
    auth.uid(),
    (select c.name from public.classrooms c where c.id=v_classroom_id),
    (select s.name from public.subjects s where s.id=v_subject_id),
    trim(_title),coalesce(_description,''),_due_at,
    nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),
    _attachment_size,nullif(trim(_attachment_type),''),
    v_inst,v_classroom_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),v_classroom_id,'task','Nova atividade: '||trim(_title),
    coalesce(nullif(trim(_description),''),'Uma nova atividade foi publicada.'),
    '/aluno/tarefas'
  );
  return result_row;
end;
$$;

create or replace function public.teacher_update_task(
  _id uuid,_classroom text,_subject text,_title text,_description text,_due_at timestamptz,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.tasks
language plpgsql security definer set search_path=''
as $$
declare
  result_row public.tasks;
  v_inst uuid;
  v_classroom_id uuid;
  v_subject_id uuid;
  v_classroom_candidate uuid;
  v_subject_candidate uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso reservado a professores autorizados.'; end if;
  v_inst := sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
  if nullif(trim(_subject),'') is null then raise exception 'Informe a disciplina.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título da atividade.'; end if;

  v_classroom_candidate := case when trim(_classroom) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_classroom)::uuid else null end;
  select c.id into v_classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=v_inst and c.status='active'
    and (c.id=v_classroom_candidate or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id=v_classroom_candidate then 0 else 1 end
  limit 1;
  if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  v_subject_candidate := case when trim(_subject) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_subject)::uuid else null end;
  select s.id into v_subject_id
  from public.subjects s
  where s.institution_id=v_inst and s.status='active'
    and (s.id=v_subject_candidate or lower(s.name)=lower(trim(_subject)))
  order by case when s.id=v_subject_candidate then 0 else 1 end
  limit 1;
  if v_subject_id is null then raise exception 'A disciplina não está disponível nesta instituição.'; end if;

  if not exists (
    select 1 from public.classroom_subjects cs
    where cs.classroom_id=v_classroom_id and cs.subject_id=v_subject_id
      and cs.institution_id=v_inst and cs.teacher_id=auth.uid()
  ) then
    raise exception 'A disciplina não está vinculada a esta turma para você.';
  end if;

  update public.tasks as t
  set classroom=(select c.name from public.classrooms c where c.id=v_classroom_id),
      classroom_id=v_classroom_id,institution_id=v_inst,
      subject=(select s.name from public.subjects s where s.id=v_subject_id),
      title=trim(_title),description=coalesce(trim(_description),''),
      due_at=_due_at,attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),attachment_size=_attachment_size,
      attachment_type=nullif(trim(_attachment_type),''),updated_at=now()
  where t.id=_id and t.teacher_id=auth.uid() and t.institution_id=v_inst
  returning t.* into result_row;

  if result_row.id is null then raise exception 'Atividade não encontrada.'; end if;
  return result_row;
end;
$$;

create or replace function public.teacher_create_announcement(
  _classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path=''
as $$
declare result_row public.announcements; v_inst uuid; v_classroom_id uuid; v_classroom_candidate uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
  v_inst:=sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione a turma.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  v_classroom_candidate:=case when trim(_classroom) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_classroom)::uuid else null end;
  select c.id into v_classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=v_inst and c.status='active'
    and (c.id=v_classroom_candidate or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id=v_classroom_candidate then 0 else 1 end
  limit 1;
  if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  insert into public.announcements(
    teacher_id,classroom,title,content,attachment_path,attachment_name,
    attachment_size,attachment_type,institution_id,classroom_id
  )
  values(
    auth.uid(),(select c.name from public.classrooms c where c.id=v_classroom_id),
    trim(_title),trim(_content),nullif(trim(_attachment_path),''),
    nullif(trim(_attachment_name),''),_attachment_size,
    nullif(trim(_attachment_type),''),v_inst,v_classroom_id
  )
  returning * into result_row;

  perform sina_private.create_classroom_notifications(
    auth.uid(),v_classroom_id,'announcement',trim(_title),
    coalesce(nullif(trim(_content),''),'Novo aviso publicado.'),'/aluno/avisos'
  );
  return result_row;
end;
$$;

create or replace function public.teacher_update_announcement(
  _id uuid,_classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path=''
as $$
declare result_row public.announcements; v_inst uuid; v_classroom_id uuid; v_classroom_candidate uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso reservado a professores autorizados.'; end if;
  v_inst:=sina_private.current_institution('teacher'::public.app_role);
  if v_inst is null then raise exception 'Professor sem instituição ativa.'; end if;
  if nullif(trim(_classroom),'') is null then raise exception 'Selecione a turma.'; end if;
  if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
  if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;

  v_classroom_candidate:=case when trim(_classroom) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then trim(_classroom)::uuid else null end;
  select c.id into v_classroom_id
  from public.classrooms c
  join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
  where c.institution_id=v_inst and c.status='active'
    and (c.id=v_classroom_candidate or lower(c.name)=lower(trim(_classroom)))
  order by case when c.id=v_classroom_candidate then 0 else 1 end
  limit 1;
  if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;

  update public.announcements as a
  set classroom=(select c.name from public.classrooms c where c.id=v_classroom_id),
      classroom_id=v_classroom_id,institution_id=v_inst,title=trim(_title),
      content=trim(_content),attachment_path=nullif(trim(_attachment_path),''),
      attachment_name=nullif(trim(_attachment_name),''),attachment_size=_attachment_size,
      attachment_type=nullif(trim(_attachment_type),''),updated_at=now()
  where a.id=_id and a.teacher_id=auth.uid() and a.institution_id=v_inst
  returning a.* into result_row;

  if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
  return result_row;
end;
$$;

revoke all on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) from public,anon;

grant execute on function public.teacher_create_task(text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_update_task(uuid,text,text,text,text,timestamptz,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) to authenticated;
