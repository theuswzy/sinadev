-- Restore the historical weekly timetable without replacing existing records.
CREATE TABLE IF NOT EXISTS public.classroom_timetable (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
 classroom_subject_id uuid NOT NULL REFERENCES public.classroom_subjects(id) ON DELETE CASCADE,
 weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 5),
 start_time time NOT NULL,
 end_time time NOT NULL,
 room text,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT classroom_timetable_time_check CHECK (end_time > start_time)
);
GRANT SELECT ON public.classroom_timetable TO authenticated;
GRANT ALL ON public.classroom_timetable TO service_role;
REVOKE ALL ON public.classroom_timetable FROM anon;
ALTER TABLE public.classroom_timetable ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS classroom_timetable_slot_unique ON public.classroom_timetable(classroom_id,weekday,start_time);
CREATE INDEX IF NOT EXISTS classroom_timetable_classroom_idx ON public.classroom_timetable(classroom_id,weekday,start_time);
DROP POLICY IF EXISTS "Authenticated timetable access" ON public.classroom_timetable;
CREATE POLICY "Authenticated timetable access" ON public.classroom_timetable FOR SELECT TO authenticated USING (
 (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.institution_memberships m WHERE m.user_id=auth.uid() AND m.institution_id=classroom_timetable.institution_id AND m.role='admin' AND m.status='active'))
 OR EXISTS (SELECT 1 FROM public.students s WHERE s.user_id=auth.uid() AND s.classroom_id=classroom_timetable.classroom_id AND s.institution_id=classroom_timetable.institution_id)
 OR EXISTS (SELECT 1 FROM public.classroom_teachers ct JOIN public.institution_memberships m ON m.user_id=ct.user_id AND m.institution_id=classroom_timetable.institution_id AND m.status='active' WHERE ct.user_id=auth.uid() AND ct.classroom_id=classroom_timetable.classroom_id)
);
CREATE OR REPLACE FUNCTION public.admin_list_classroom_timetable(_classroom_id uuid)
RETURNS TABLE(id uuid,classroom_id uuid,classroom_subject_id uuid,weekday smallint,start_time time,end_time time,room text,notes text,subject_id uuid,subject_name text,teacher_id uuid,teacher_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_institution uuid;
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito ao administrador.'; END IF;
 v_institution:=sina_private.current_institution('admin'::public.app_role);
 IF NOT EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id=_classroom_id AND c.institution_id=v_institution) THEN RAISE EXCEPTION 'Turma não encontrada.'; END IF;
 RETURN QUERY SELECT t.id,t.classroom_id,t.classroom_subject_id,t.weekday,t.start_time,t.end_time,t.room,t.notes,cs.subject_id,s.name,cs.teacher_id,p.display_name
 FROM public.classroom_timetable t JOIN public.classroom_subjects cs ON cs.id=t.classroom_subject_id JOIN public.subjects s ON s.id=cs.subject_id LEFT JOIN public.profiles p ON p.user_id=cs.teacher_id
 WHERE t.classroom_id=_classroom_id AND t.institution_id=v_institution ORDER BY t.weekday,t.start_time;
END;$function$;
CREATE OR REPLACE FUNCTION public.admin_upsert_classroom_timetable(_id uuid,_classroom_id uuid,_classroom_subject_id uuid,_weekday smallint,_start_time time,_end_time time,_room text DEFAULT NULL,_notes text DEFAULT NULL)
RETURNS public.classroom_timetable LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_institution uuid; v_row public.classroom_timetable;
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito ao administrador.'; END IF;
 v_institution:=sina_private.current_institution('admin'::public.app_role);
 IF _weekday IS NULL OR _weekday NOT BETWEEN 1 AND 5 OR _start_time IS NULL OR _end_time IS NULL OR _end_time<=_start_time THEN RAISE EXCEPTION 'Horário inválido.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.classroom_subjects cs JOIN public.classrooms c ON c.id=cs.classroom_id WHERE cs.id=_classroom_subject_id AND cs.classroom_id=_classroom_id AND cs.institution_id=v_institution AND c.institution_id=v_institution AND c.status='active') THEN RAISE EXCEPTION 'Disciplina não vinculada a esta turma ativa.'; END IF;
 IF _id IS NULL THEN
  INSERT INTO public.classroom_timetable(institution_id,classroom_id,classroom_subject_id,weekday,start_time,end_time,room,notes) VALUES(v_institution,_classroom_id,_classroom_subject_id,_weekday,_start_time,_end_time,nullif(trim(coalesce(_room,'')),''),nullif(trim(coalesce(_notes,'')),'')) RETURNING * INTO v_row;
 ELSE
  UPDATE public.classroom_timetable SET classroom_subject_id=_classroom_subject_id,weekday=_weekday,start_time=_start_time,end_time=_end_time,room=nullif(trim(coalesce(_room,'')),''),notes=nullif(trim(coalesce(_notes,'')),''),updated_at=now() WHERE id=_id AND institution_id=v_institution AND classroom_id=_classroom_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Horário não encontrado.'; END IF;
 END IF;
 RETURN v_row;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Já existe uma aula cadastrada nesse dia e horário para esta turma.';
END;$function$;
CREATE OR REPLACE FUNCTION public.admin_delete_classroom_timetable(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_institution uuid;
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Acesso restrito ao administrador.'; END IF;
 v_institution:=sina_private.current_institution('admin'::public.app_role);
 DELETE FROM public.classroom_timetable WHERE id=_id AND institution_id=v_institution;
 RETURN FOUND;
END;$function$;
CREATE OR REPLACE FUNCTION public.student_list_timetable()
RETURNS TABLE(id uuid,classroom_id uuid,classroom_name text,classroom_subject_id uuid,weekday smallint,start_time time,end_time time,room text,notes text,subject_id uuid,subject_name text,teacher_id uuid,teacher_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para continuar.'; END IF;
 RETURN QUERY SELECT t.id,t.classroom_id,c.name,t.classroom_subject_id,t.weekday,t.start_time,t.end_time,t.room,t.notes,cs.subject_id,s.name,cs.teacher_id,p.display_name
 FROM public.classroom_timetable t JOIN public.classrooms c ON c.id=t.classroom_id JOIN public.classroom_subjects cs ON cs.id=t.classroom_subject_id JOIN public.subjects s ON s.id=cs.subject_id LEFT JOIN public.profiles p ON p.user_id=cs.teacher_id
 WHERE EXISTS (SELECT 1 FROM public.students st WHERE st.user_id=auth.uid() AND st.classroom_id=t.classroom_id AND st.institution_id=t.institution_id)
 AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.user_id=auth.uid() AND me.status='active')
 ORDER BY t.weekday,t.start_time;
END;$function$;
REVOKE ALL ON FUNCTION public.admin_list_classroom_timetable(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_upsert_classroom_timetable(uuid,uuid,uuid,smallint,time,time,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_delete_classroom_timetable(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.student_list_timetable() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_classroom_timetable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_classroom_timetable(uuid,uuid,uuid,smallint,time,time,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_classroom_timetable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_list_timetable() TO authenticated;
DO $publication$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='classroom_timetable') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_timetable;
 END IF;
END;$publication$;