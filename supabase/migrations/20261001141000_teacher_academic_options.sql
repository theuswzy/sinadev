create or replace function public.teacher_list_academic_options()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare inst uuid;
begin
  if not public.has_role(auth.uid(),'teacher'::public.app_role) then raise exception 'Acesso restrito ao professor'; end if;
  inst:=sina_private.current_institution('teacher'::public.app_role);
  return jsonb_build_object(
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code) order by name) from public.subjects where institution_id=inst and status='active'),'[]'::jsonb),
    'terms', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'starts_at',starts_at,'ends_at',ends_at,'is_current',is_current) order by starts_at nulls last,name) from public.academic_terms where institution_id=inst),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.teacher_list_academic_options() from public, anon;
grant execute on function public.teacher_list_academic_options() to authenticated;
