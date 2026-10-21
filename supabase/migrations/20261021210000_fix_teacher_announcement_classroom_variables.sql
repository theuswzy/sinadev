-- Disambiguate classroom identifiers in announcement create/update RPCs.
-- Preserve legacy class-name support, attachment fields, tenant scoping, and notifications.
create or replace function public.teacher_create_announcement(
  _classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path=''
as $function$
declare result_row public.announcements; inst uuid; v_classroom_id uuid; v_classroom_name text;
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito a professores.'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
 if nullif(trim(_classroom),'') is null then raise exception 'Selecione uma turma.'; end if;
 if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
 if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;
 select c.id,c.name into v_classroom_id,v_classroom_name from public.classrooms c
 join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
 where c.id::text=trim(_classroom) and c.institution_id=inst and c.status='active' limit 1;
 if v_classroom_id is null then
   select c.id,c.name into v_classroom_id,v_classroom_name from public.classrooms c
   join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
   where lower(c.name)=lower(trim(_classroom)) and c.institution_id=inst and c.status='active'
   order by c.created_at desc limit 1;
 end if;
 if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;
 insert into public.announcements(teacher_id,classroom,title,content,attachment_path,attachment_name,attachment_size,attachment_type,institution_id,classroom_id)
 values(auth.uid(),v_classroom_name,trim(_title),trim(_content),nullif(trim(_attachment_path),''),nullif(trim(_attachment_name),''),_attachment_size,nullif(trim(_attachment_type),''),inst,v_classroom_id)
 returning * into result_row;
 perform sina_private.create_classroom_notifications(auth.uid(),v_classroom_id,'announcement',trim(_title),trim(_content),'/aluno/avisos');
 return result_row;
end;$function$;

create or replace function public.teacher_update_announcement(
  _id uuid,_classroom text,_title text,_content text,
  _attachment_path text default null,_attachment_name text default null,
  _attachment_size bigint default null,_attachment_type text default null
)
returns public.announcements
language plpgsql security definer set search_path=''
as $function$
declare result_row public.announcements; inst uuid; v_classroom_id uuid; v_classroom_name text;
begin
 if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso reservado a professores autorizados.'; end if;
 inst:=sina_private.current_institution('teacher'::public.app_role);
 if inst is null then raise exception 'Professor sem instituição ativa.'; end if;
 select c.id,c.name into v_classroom_id,v_classroom_name from public.classrooms c
 join public.classroom_teachers ct on ct.classroom_id=c.id and ct.user_id=auth.uid()
 where c.institution_id=inst and c.status='active'
 and (c.id::text=trim(_classroom) or lower(c.name)=lower(trim(_classroom)))
 order by case when c.id::text=trim(_classroom) then 0 else 1 end,c.created_at desc limit 1;
 if v_classroom_id is null then raise exception 'A turma selecionada não pertence a você.'; end if;
 if nullif(trim(_title),'') is null then raise exception 'Informe o título do aviso.'; end if;
 if nullif(trim(_content),'') is null then raise exception 'Escreva o conteúdo do aviso.'; end if;
 update public.announcements a set classroom=v_classroom_name,classroom_id=v_classroom_id,institution_id=inst,
 title=trim(_title),content=trim(_content),attachment_path=nullif(trim(_attachment_path),''),attachment_name=nullif(trim(_attachment_name),''),
 attachment_size=_attachment_size,attachment_type=nullif(trim(_attachment_type),''),updated_at=now()
 where a.id=_id and a.teacher_id=auth.uid() and a.institution_id=inst returning a.* into result_row;
 if result_row.id is null then raise exception 'Aviso não encontrado.'; end if;
 return result_row;
end;$function$;

revoke all on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) from public,anon;
revoke all on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) from public,anon;
grant execute on function public.teacher_create_announcement(text,text,text,text,text,bigint,text) to authenticated;
grant execute on function public.teacher_update_announcement(uuid,text,text,text,text,text,bigint,text) to authenticated;
