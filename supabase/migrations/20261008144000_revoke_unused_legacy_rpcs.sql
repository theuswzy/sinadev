-- Remove direct client access to superseded RPCs.
-- These functions remain in the database for historical compatibility, but the
-- application uses newer institution-aware flows and should not expose the old
-- entry points through PostgREST.

revoke execute on function public.admin_list_role_requests() from public, anon, authenticated;
revoke execute on function public.admin_review_role_request(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.admin_set_academic_role(uuid,text) from public, anon, authenticated;

revoke execute on function public.teacher_claim_classroom(uuid) from public, anon, authenticated;
revoke execute on function public.teacher_archive_subject(uuid) from public, anon, authenticated;
revoke execute on function public.teacher_bulk_upsert_grades(uuid,text,integer,jsonb) from public, anon, authenticated;
revoke execute on function public.teacher_upsert_grade(uuid,text,integer,numeric,integer) from public, anon, authenticated;
revoke execute on function public.teacher_link_roster_student(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.teacher_unlink_roster_student(uuid) from public, anon, authenticated;
revoke execute on function public.teacher_unlink_student(uuid) from public, anon, authenticated;

-- Trigger-only functions are not application RPCs and should not be callable by clients.
revoke execute on function public.enforce_grade_period_and_audit() from public, anon, authenticated;
revoke execute on function public.notify_teacher_task_submission() from public, anon, authenticated;
