create or replace function public.admin_get_academic_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inst uuid;
  v_performance jsonb;
  v_attendance_breakdown jsonb;
  v_classrooms jsonb;
  v_attention jsonb;
begin
  if not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  inst := sina_private.current_institution('admin'::public.app_role);
  if inst is null then
    raise exception 'Nenhuma instituição ativa encontrada.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'period', x.period,
        'average', x.average,
        'launches', x.launches
      ) order by x.period
    ),
    '[]'::jsonb
  )
  into v_performance
  from (
    select g.period, round(avg(g.score),2) as average, count(*) as launches
    from public.grades g
    where g.institution_id = inst and g.score is not null
    group by g.period
  ) x;

  select jsonb_build_object(
    'present', count(*) filter (where a.status='present'),
    'absent', count(*) filter (where a.status='absent')
  )
  into v_attendance_breakdown
  from public.attendance_records a
  where a.institution_id = inst and a.status in ('present','absent');

  with grade_agg as (
    select g.student_id, avg(g.score) as average
    from public.grades g
    where g.institution_id = inst and g.score is not null
    group by g.student_id
  ),
  attendance_agg as (
    select a.student_id,
      100.0 * count(*) filter (where a.status='present') / nullif(count(*),0) as attendance_percent
    from public.attendance_records a
    where a.institution_id = inst and a.status in ('present','absent')
    group by a.student_id
  ),
  class_metrics as (
    select
      c.id,
      c.name,
      round(avg(ga.average),2) as average,
      round(avg(aa.attendance_percent),1) as attendance_percent
    from public.classrooms c
    left join public.students s on s.classroom_id=c.id and s.institution_id=inst
    left join grade_agg ga on ga.student_id=s.id
    left join attendance_agg aa on aa.student_id=s.id
    where c.institution_id=inst and c.status='active'
    group by c.id,c.name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'average', average,
        'attendance_percent', attendance_percent
      ) order by name
    ),
    '[]'::jsonb
  )
  into v_classrooms
  from class_metrics
  where average is not null or attendance_percent is not null;

  with grade_agg as (
    select g.student_id, avg(g.score) as average
    from public.grades g
    where g.institution_id = inst and g.score is not null
    group by g.student_id
  ),
  attendance_agg as (
    select a.student_id,
      100.0 * count(*) filter (where a.status='present') / nullif(count(*),0) as attendance_percent
    from public.attendance_records a
    where a.institution_id = inst and a.status in ('present','absent')
    group by a.student_id
  ),
  class_metrics as (
    select c.id,c.name,round(avg(ga.average),2) as average,round(avg(aa.attendance_percent),1) as attendance_percent
    from public.classrooms c
    left join public.students s on s.classroom_id=c.id and s.institution_id=inst
    left join grade_agg ga on ga.student_id=s.id
    left join attendance_agg aa on aa.student_id=s.id
    where c.institution_id=inst and c.status='active'
    group by c.id,c.name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'average', average,
        'attendance_percent', attendance_percent
      ) order by average nulls first, name
    ),
    '[]'::jsonb
  )
  into v_attention
  from class_metrics
  where coalesce(average,10) < 6 or coalesce(attendance_percent,100) < 75;

  return jsonb_build_object(
    'students', (select count(*) from public.students s where s.institution_id=inst),
    'students_without_class', (select count(*) from public.students s where s.institution_id=inst and s.classroom_id is null),
    'classrooms', (select count(*) from public.classrooms c where c.institution_id=inst and c.status='active'),
    'teachers', (
      select count(distinct ct.user_id)
      from public.classroom_teachers ct
      join public.classrooms c on c.id=ct.classroom_id
      where c.institution_id=inst
    ),
    'grades_count', (select count(*) from public.grades g where g.institution_id=inst and g.score is not null),
    'average', (select round(avg(g.score),2) from public.grades g where g.institution_id=inst and g.score is not null),
    'attendance_percent', (
      select round(
        100.0 * count(*) filter (where a.status='present')
        / nullif(count(*) filter (where a.status in ('present','absent')),0),
        1
      )
      from public.attendance_records a
      where a.institution_id=inst
    ),
    'students_below_average', (
      select count(*) from (
        select g.student_id
        from public.grades g
        where g.institution_id=inst and g.score is not null
        group by g.student_id
        having avg(g.score) < 6
      ) q
    ),
    'students_low_attendance', (
      select count(*) from (
        select a.student_id
        from public.attendance_records a
        where a.institution_id=inst and a.status in ('present','absent')
        group by a.student_id
        having 100.0 * count(*) filter (where a.status='present') / nullif(count(*),0) < 75
      ) q
    ),
    'performance_by_period', v_performance,
    'attendance_breakdown', v_attendance_breakdown,
    'classroom_performance', v_classrooms,
    'classrooms_attention', v_attention
  );
end;
$$;

revoke all on function public.admin_get_academic_overview() from public, anon;
grant execute on function public.admin_get_academic_overview() to authenticated;
