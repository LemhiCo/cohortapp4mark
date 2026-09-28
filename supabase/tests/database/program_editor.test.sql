begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

set local role postgres;

insert into public.admin_allowlist (email) values ('program-admin@lemhi.com')
on conflict (email) do update set active = true;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'program-admin@lemhi.com', now(), '{}', '{}', now(), now());

-- A separate program with one week and two tasks. Only one program may be
-- active; propagation doesn't depend on that flag.
insert into public.programs (id, name, active) values ('5a000000-0000-4000-8000-000000000001', 'Editor test program', false);
insert into public.program_weeks (id, program_id, week_number, title, subtitle, goal)
values ('5b000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', 1, 'Original week', 'Original subtitle', 'Original goal');
insert into public.program_tasks (id, program_id, week_id, position, title, owner_label, owner_type) values
  ('5c000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', '5b000000-0000-4000-8000-000000000001', 1, 'Original task', 'MSP IT admin', 'msp'),
  ('5c000000-0000-4000-8000-000000000002', '5a000000-0000-4000-8000-000000000001', '5b000000-0000-4000-8000-000000000001', 2, 'Second task', 'MSP IT admin', 'msp');

-- Active, upcoming and ended cohorts all start from the same template.
insert into public.cohorts (id, program_id, name, start_date, timezone, session_weekday, session_time) values
  ('5d000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', 'Editor active',
   (now() at time zone 'America/New_York')::date, 'America/New_York', 1, '11:00'),
  ('5d000000-0000-4000-8000-000000000002', '5a000000-0000-4000-8000-000000000001', 'Editor upcoming',
   (now() at time zone 'America/New_York')::date + 10, 'America/New_York', 1, '11:00'),
  ('5d000000-0000-4000-8000-000000000003', '5a000000-0000-4000-8000-000000000001', 'Editor ended',
   (now() at time zone 'America/New_York')::date - 40, 'America/New_York', 1, '11:00');

insert into public.msps (id, cohort_id, name)
values ('5e000000-0000-4000-8000-000000000001', '5d000000-0000-4000-8000-000000000001', 'Editor MSP');
insert into public.task_completions (msp_id, cohort_task_id, completed_by)
select '5e000000-0000-4000-8000-000000000001', id, 'a8000000-0000-4000-8000-000000000001'
from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000001' and template_task_id = '5c000000-0000-4000-8000-000000000001';

-- Edits reach running cohorts only.
update public.program_tasks set title = 'Edited task' where id = '5c000000-0000-4000-8000-000000000001';
update public.program_weeks set subtitle = 'Edited subtitle' where id = '5b000000-0000-4000-8000-000000000001';

select is(
  (select title from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000001' and template_task_id = '5c000000-0000-4000-8000-000000000001'),
  'Edited task', 'A task edit reaches the active cohort'
);
select is(
  (select title from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000002' and template_task_id = '5c000000-0000-4000-8000-000000000001'),
  'Edited task', 'A task edit reaches the upcoming cohort'
);
select is(
  (select title from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000003' and template_task_id = '5c000000-0000-4000-8000-000000000001'),
  'Original task', 'An ended cohort keeps the original task'
);
select is(
  (select array_agg(subtitle order by cohort_id) from public.cohort_weeks where template_week_id = '5b000000-0000-4000-8000-000000000001'),
  array['Edited subtitle', 'Edited subtitle', 'Original subtitle'],
  'A week edit reaches running cohorts and not the ended one'
);

-- A new program task is added to running cohorts only.
insert into public.program_tasks (id, program_id, week_id, position, title, owner_label, owner_type)
values ('5c000000-0000-4000-8000-000000000003', '5a000000-0000-4000-8000-000000000001', '5b000000-0000-4000-8000-000000000001', 3, 'New task', 'Account team', 'msp');
select is(
  (select array_agg(c.name order by c.name) from public.cohort_tasks ct join public.cohorts c on c.id = ct.cohort_id
   where ct.template_task_id = '5c000000-0000-4000-8000-000000000003'),
  array['Editor active', 'Editor upcoming'],
  'A new task is added to the active and upcoming cohorts only'
);
select is(
  (select overall_total_tasks from public.msp_progress where msp_id = '5e000000-0000-4000-8000-000000000001' limit 1),
  3, 'The MSP''s progress counts the new task'
);

-- Archiving hides the task from running cohorts but keeps its history.
update public.program_tasks set archived_at = now() where id = '5c000000-0000-4000-8000-000000000001';
select isnt(
  (select archived_at from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000001' and template_task_id = '5c000000-0000-4000-8000-000000000001'),
  null, 'Archiving reaches the active cohort'
);
select is(
  (select archived_at from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000003' and template_task_id = '5c000000-0000-4000-8000-000000000001'),
  null, 'An ended cohort keeps the archived task'
);
select is(
  (select overall_total_tasks from public.msp_progress where msp_id = '5e000000-0000-4000-8000-000000000001' limit 1),
  2, 'An archived task leaves the MSP''s progress'
);
select is(
  (select count(*) from public.task_completions where msp_id = '5e000000-0000-4000-8000-000000000001'),
  1::bigint, 'The completion of an archived task is kept'
);

-- Restoring brings it back.
update public.program_tasks set archived_at = null where id = '5c000000-0000-4000-8000-000000000001';
select is(
  (select archived_at from public.cohort_tasks where cohort_id = '5d000000-0000-4000-8000-000000000001' and template_task_id = '5c000000-0000-4000-8000-000000000001'),
  null, 'Restoring brings the task back to the active cohort'
);

select * from finish();
rollback;
