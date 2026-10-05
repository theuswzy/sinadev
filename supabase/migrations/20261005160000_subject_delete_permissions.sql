-- Permite excluir disciplinas com segurança por instituição.
-- Registros históricos que possuem subject_id usam SET NULL; vínculos
-- classroom_subjects são removidos em CASCADE conforme o esquema atual.

create or replace function public.teacher_delete_subject(_id uuid)
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

  delete from public.subjects
  where id=_id
    and institution_id=inst
    and created_by=auth.uid();

  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'Disciplina não encontrada ou criada por outro usuário.';
  end if;

  return true;
end;
$function$;

create or replace function public.admin_delete_subject(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inst uuid;
  affected integer;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  inst := sina_private.current_institution('admin'::public.app_role);
  if inst is null then
    raise exception 'Administrador sem instituição ativa.';
  end if;

  delete from public.subjects
  where id=_id
    and institution_id=inst;

  get diagnostics affected = row_count;

  if affected = 0 then
    raise exception 'Disciplina não encontrada na instituição ativa.';
  end if;

  return true;
end;
$function$;
