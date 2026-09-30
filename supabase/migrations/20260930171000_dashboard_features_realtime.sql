do $$
begin
  begin
    alter publication supabase_realtime add table public.announcements;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.task_completions;
  exception when duplicate_object then null;
  end;
end;
$$;
