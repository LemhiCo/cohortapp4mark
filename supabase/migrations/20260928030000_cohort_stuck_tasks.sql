-- Tasks from weeks that have already passed which active MSPs still have
-- open, for the admin dashboard's stuck-task ranking. Counts follow each
-- MSP's own checklist (hidden and extra tasks), like msp_progress. It runs
-- with the caller's permissions, so an MSP querying it only counts itself.
create view public.cohort_stuck_tasks
with (security_invoker = true) as
select
  ct.id as cohort_task_id,
  ct.cohort_id,
  cw.week_number,
  ct.title,
  ct.owner_type,
  ct.kind,
  count(*)::integer as eligible_msps,
  (count(*) filter (where tc.cohort_task_id is null))::integer as open_msps
from public.cohort_tasks ct
join public.cohort_weeks cw on cw.id = ct.cohort_week_id
join public.msps m
  on m.cohort_id = ct.cohort_id
  and m.status = 'active'
  and (ct.msp_id is null or ct.msp_id = m.id)
left join public.msp_hidden_tasks hidden
  on hidden.msp_id = m.id and hidden.cohort_task_id = ct.id
left join public.task_completions tc
  on tc.msp_id = m.id and tc.cohort_task_id = ct.id
where ct.archived_at is null
  and hidden.cohort_task_id is null
  and cw.week_number < public.cohort_current_week(ct.cohort_id)
group by ct.id, ct.cohort_id, cw.week_number, ct.title, ct.owner_type, ct.kind
having count(*) filter (where tc.cohort_task_id is null) > 0;

revoke all on public.cohort_stuck_tasks from anon;
grant select on public.cohort_stuck_tasks to authenticated;
