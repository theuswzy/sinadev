-- SINA: students may access their account immediately after email confirmation.
-- Academic linkage/teacher/turma assignment remains controlled separately.
create or replace function public.ensure_account_onboarding_v2(
  _requested_role text,
  _school_directory_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := auth.uid();
  requested text := nullif(trim(_requested_role), '');
  display_name text;
  current_status text;
  current_role text;
  request_row public.account_role_requests;
  school public.school_directory;
  inst uuid;
begin
  if uid is null then raise exception 'Usuário não autenticado.'; end if;
  if requested not in ('student','teacher') then
    raise exception 'Escolha uma função válida: aluno ou professor.';
  end if;

  select * into school
  from public.school_directory
  where id = _school_directory_id and status = 'active'
  limit 1;

  if school.id is null then
    raise exception 'Selecione uma escola válida para continuar.';
  end if;

  select coalesce(
    nullif(p.display_name,''),
    nullif(au.raw_user_meta_data->>'display_name',''),
    split_part(coalesce(au.email,''),'@',1)
  ), p.status
  into display_name, current_status
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  where au.id = uid;

  select r.role::text into current_role
  from public.user_roles r
  where r.user_id = uid
    and r.role in ('admin','teacher','student')
  order by case when r.role='admin' then 0 when r.role='teacher' then 1 else 2 end
  limit 1;

  if current_role = 'admin' then
    return jsonb_build_object(
      'status','active','role',current_role,'requested_role',current_role,
      'request_status','approved','request_id',null,'review_note',null
    );
  end if;

  -- STUDENT: account access is immediate. School/classroom/academic data
  -- can still be linked later by an authorized administrator/teacher.
  if requested = 'student' then
    if current_role is null then
      insert into public.user_roles(user_id, role)
      values(uid, 'student'::public.app_role)
      on conflict (user_id, role) do nothing;
      current_role := 'student';
    end if;

    select d.institution_id into inst
    from public.school_directory d
    where d.id = school.id;

    if inst is not null then
      insert into public.institution_memberships(institution_id,user_id,role,status)
      values(inst,uid,'student'::public.app_role,'active')
      on conflict (institution_id,user_id,role) do update set status='active';
    end if;

    insert into public.profiles(user_id,display_name,status)
    values(uid,coalesce(display_name,'Aluno'),'active')
    on conflict(user_id) do update set
      display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
      status='active',
      updated_at=now();

    if inst is not null then
      insert into public.students(user_id,full_name,enrollment,classroom,teacher_id,institution_id)
      values(uid,coalesce(display_name,'Aluno'),'','',null,inst)
      on conflict(user_id) where user_id is not null do update
        set institution_id=coalesce(public.students.institution_id,excluded.institution_id),
            updated_at=now();
    end if;

    return jsonb_build_object(
      'status','active',
      'role','student',
      'requested_role','student',
      'request_status','approved',
      'request_id',null,
      'review_note',null
    );
  end if;

  -- TEACHER: remains subject to administrator approval.
  if current_role = 'teacher' then
    return jsonb_build_object(
      'status',coalesce(current_status,'active'),
      'role','teacher',
      'requested_role','teacher',
      'request_status','approved',
      'request_id',null,
      'review_note',null
    );
  end if;

  insert into public.profiles(user_id,display_name,status)
  values(uid,coalesce(display_name,'Usuário'),'pending')
  on conflict(user_id) do update set
    display_name=case when public.profiles.display_name='' then excluded.display_name else public.profiles.display_name end,
    status='pending',
    updated_at=now();

  select * into request_row
  from public.account_role_requests
  where user_id=uid and status='pending'
  order by created_at desc
  limit 1;

  if request_row.id is null then
    insert into public.account_role_requests(user_id,requested_role,status,school_directory_id)
    values(uid,requested::public.app_role,'pending',school.id)
    returning * into request_row;
  else
    update public.account_role_requests
    set requested_role=requested::public.app_role,
        school_directory_id=school.id,
        updated_at=now()
    where id=request_row.id
    returning * into request_row;
  end if;

  return jsonb_build_object(
    'status','pending',
    'role',null,
    'requested_role',request_row.requested_role::text,
    'request_status',request_row.status,
    'request_id',request_row.id,
    'review_note',request_row.review_note
  );
end;
$$;

revoke all on function public.ensure_account_onboarding_v2(text,uuid) from public, anon;
grant execute on function public.ensure_account_onboarding_v2(text,uuid) to authenticated;
