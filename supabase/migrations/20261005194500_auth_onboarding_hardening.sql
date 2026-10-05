-- SINA auth hardening: keep the account/onboarding trigger compatible with
-- immediate student access, including students who register without a school.
--
-- This is a new migration on purpose. Editing an already-applied migration does
-- not change a remote database; Supabase only runs migrations that are missing
-- from the remote migration history.

create or replace function public.ensure_account_onboarding_v2(
  _requested_role text,
  _school_directory_id uuid default null
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
  if uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if requested not in ('student','teacher') then
    raise exception 'Escolha uma função válida: aluno ou professor.';
  end if;

  if _school_directory_id is not null then
    select * into school
    from public.school_directory
    where id = _school_directory_id
      and status = 'active'
    limit 1;

    if school.id is null then
      raise exception 'A escola selecionada não está disponível.';
    end if;
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
  order by case
    when r.role='admin' then 0
    when r.role='teacher' then 1
    else 2
  end
  limit 1;

  if current_role = 'admin' then
    return jsonb_build_object(
      'status','active',
      'role','admin',
      'requested_role','admin',
      'request_status','approved',
      'request_id',null,
      'review_note',null
    );
  end if;

  -- STUDENT: never wait for administrator approval. School, classroom and
  -- academic records are optional and can be linked later.
  if requested = 'student' then
    insert into public.user_roles(user_id, role)
    values(uid, 'student'::public.app_role)
    on conflict (user_id, role) do nothing;

    if school.id is not null then
      inst := school.institution_id;

      if inst is not null then
        insert into public.institution_memberships(
          institution_id,user_id,role,status
        )
        values(inst,uid,'student'::public.app_role,'active')
        on conflict (institution_id,user_id,role)
        do update set status='active';

        insert into public.students(
          user_id,full_name,enrollment,classroom,teacher_id,institution_id
        )
        values(
          uid,coalesce(display_name,'Aluno'),'','',null,inst
        )
        on conflict(user_id) where user_id is not null
        do update set
          institution_id=coalesce(public.students.institution_id,excluded.institution_id),
          updated_at=now();
      end if;
    end if;

    insert into public.profiles(user_id,display_name,status)
    values(uid,coalesce(display_name,'Aluno'),'active')
    on conflict(user_id) do update set
      display_name=case
        when public.profiles.display_name='' then excluded.display_name
        else public.profiles.display_name
      end,
      status='active',
      updated_at=now();

    return jsonb_build_object(
      'status','active',
      'role','student',
      'requested_role','student',
      'request_status','approved',
      'request_id',null,
      'review_note',null
    );
  end if;

  -- TEACHER: a school is mandatory and administrator approval is required.
  if school.id is null then
    raise exception 'Selecione a instituição onde você leciona.';
  end if;

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
    display_name=case
      when public.profiles.display_name='' then excluded.display_name
      else public.profiles.display_name
    end,
    status='pending',
    updated_at=now();

  select * into request_row
  from public.account_role_requests
  where user_id=uid
    and status='pending'
  order by created_at desc
  limit 1;

  if request_row.id is null then
    insert into public.account_role_requests(
      user_id,requested_role,status,school_directory_id
    )
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

-- Keep the auth trigger deterministic for both registration paths.
create or replace function public.new_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'requested_role','student');
  display_name text := coalesce(new.raw_user_meta_data->>'display_name','');
begin
  insert into public.profiles (user_id, display_name, status)
  values (
    new.id,
    display_name,
    case when requested_role = 'teacher' then 'pending' else 'active' end
  )
  on conflict (user_id) do update set
    display_name = case
      when public.profiles.display_name = '' then excluded.display_name
      else public.profiles.display_name
    end,
    status = case
      when requested_role = 'teacher' then public.profiles.status
      else 'active'
    end,
    updated_at = now();

  if requested_role <> 'teacher' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'student'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_sina_signup on auth.users;
create trigger on_sina_signup
after insert on auth.users
for each row execute function public.new_account();

revoke all on function public.new_account() from public, anon, authenticated;
