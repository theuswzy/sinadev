-- Harden the remaining exposed SECURITY DEFINER functions with an empty search_path.

create or replace function public.new_account()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  requested_role text:=coalesce(new.raw_user_meta_data->>'requested_role','student');
  display_name text:=coalesce(new.raw_user_meta_data->>'display_name','');
begin
  insert into public.profiles(user_id,display_name,status)
  values(
    new.id,
    display_name,
    case when requested_role='teacher' then 'pending' else 'active' end
  )
  on conflict(user_id) do update set
    display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
    status=case when requested_role='teacher' then public.profiles.status else 'active' end,
    updated_at=now();

  if requested_role<>'teacher' then
    insert into public.user_roles(user_id,role)
    values(new.id,'student'::public.app_role)
    on conflict(user_id,role) do nothing;
  end if;

  return new;
end;
$function$;

create or replace function public.student_update_profile(_full_name text,_avatar_url text default null)
returns public.students
language plpgsql
security definer
set search_path=''
as $function$
declare
  student_row public.students;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  update public.students
  set
    full_name=coalesce(nullif(trim(_full_name),''),full_name),
    avatar_url=nullif(trim(coalesce(_avatar_url,'')),''),
    updated_at=now()
  where user_id=auth.uid()
  returning * into student_row;

  if student_row.id is null then
    raise exception 'Perfil de aluno não encontrado';
  end if;

  return student_row;
end;
$function$;

revoke execute on function public.student_update_profile(text,text) from public,anon;
grant execute on function public.student_update_profile(text,text) to authenticated;
