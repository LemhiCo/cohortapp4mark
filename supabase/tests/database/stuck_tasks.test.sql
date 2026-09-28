begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

set local role postgres;

insert into public.admin_allowlist (email) values ('stuck-admin@lemhi.com')
on conflict (email) do update set active = true;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a6000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'stuck-admin@lemhi.com', now(), '{}', '{}', now(), now());

-- Started eight local days ago, so Week 1 is in the past and Week 2 is current.
insert into public.cohorts (id, program_id, name, start_date, timezone, session_weekday, session_time)
values ('47000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Stuck cohort',
        (now() at time zone 'America/New_York')::date - 8, 'America/New_York', 1, '11:00');

insert into public.msps (id, cohort_id, name) values
  ('48000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001', 'Stuck MSP A'),
  ('48000000-0000-4000-8000-000000000002', '47000000-0000-4000-8000-000000000001', 'Stuck MSP B');

insert into public.invitations (email, role, msp_id, invited_by, expires_at) values
  ('stuck-b@example.test', 'msp_owner', '48000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000001', now() + interval '1 day');
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a6000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'stuck-b@example.test', now(), '{}', '{}', now(), now());

create temporary table week_one on commit drop as
select ct.id, ct.position, ct.cohort_week_id
from public.cohort_tasks ct
join public.cohort_weeks cw on cw.id = ct.cohort_week_id
where ct.cohort_id = '47000000-0000-4000-8000-000000000001' and cw.week_number = 1;
grant select on week_one to authenticated;

-- A finishes Week 1 except its last task; B also leaves the sixth task open.
insert into public.task_completions (msp_id, cohort_task_id, completed_by)
select '48000000-0000-4000-8000-000000000001'::uuid, id, 'a6000000-0000-4000-8000-000000000001'::uuid from week_one where position <= 6
union all
select '48000000-0000-4000-8000-000000000002'::uuid, id, 'a6000000-0000-4000-8000-000000000001'::uuid from week_one where position <= 5;

select is(
  (select count(*) from public.cohort_stuck_tasks where cohort_id = '47000000-0000-4000-8000-000000000001'),
  2::bigint,
  'Only past-week tasks with open MSPs are listed'
);
select is(
  (select row(open_msps, eligible_msps) from public.cohort_stuck_tasks where cohort_task_id = (select id from week_one where position = 7)),
  row(2, 2),
  'The last Week 1 task is open for both MSPs'
);
select is(
  (select row(open_msps, eligible_msps) from public.cohort_stuck_tasks where cohort_task_id = (select id from week_one where position = 6)),
  row(1, 2),
  'The sixth Week 1 task is open for one of two MSPs'
);
select is(
  (select count(*) from public.cohort_stuck_tasks where cohort_id = '47000000-0000-4000-8000-000000000001' and week_number >= 2),
  0::bigint,
  'Tasks from the current week are not stuck yet'
);

-- A task hidden for B no longer counts against B.
insert into public.msp_hidden_tasks (msp_id, cohort_task_id, hidden_by)
values ('48000000-0000-4000-8000-000000000002', (select id from week_one where position = 7), 'a6000000-0000-4000-8000-000000000001');
select is(
  (select row(open_msps, eligible_msps) from public.cohort_stuck_tasks where cohort_task_id = (select id from week_one where position = 7)),
  row(1, 1),
  'A hidden task only counts the MSPs it is still assigned to'
);

-- An extra Week 1 task for A counts only A.
insert into public.cohort_tasks (id, cohort_id, cohort_week_id, msp_id, position, title, owner_label, owner_type)
values ('49000000-0000-4000-8000-000000000001', '47000000-0000-4000-8000-000000000001',
        (select cohort_week_id from week_one limit 1), '48000000-0000-4000-8000-000000000001', 8, 'Extra for A', 'MSP IT admin', 'msp');
select is(
  (select row(open_msps, eligible_msps) from public.cohort_stuck_tasks where cohort_task_id = '49000000-0000-4000-8000-000000000001'),
  row(1, 1),
  'An extra task for one MSP counts only that MSP'
);

-- An MSP querying the view only ever counts itself.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a6000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
select is(
  (select max(eligible_msps) from public.cohort_stuck_tasks),
  1,
  'An MSP sees counts for its own MSP only'
);
select is(
  (select count(*) from public.cohort_stuck_tasks where cohort_task_id = '49000000-0000-4000-8000-000000000001'),
  0::bigint,
  'An MSP does not see another MSP''s extra task'
);

select * from finish();
rollback;
