begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

set local role postgres;

insert into public.admin_allowlist (email) values ('custom-admin@lemhi.com')
on conflict (email) do update set active = true;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a7000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'custom-admin@lemhi.com', now(), '{}', '{}', now(), now());

insert into public.cohorts (id, program_id, name, start_date, timezone, session_weekday, session_time)
values ('4a000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Custom cohort',
        (now() at time zone 'America/New_York')::date, 'America/New_York', 1, '11:00');
insert into public.msps (id, cohort_id, name) values
  ('4b000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', 'Custom MSP A'),
  ('4b000000-0000-4000-8000-000000000002', '4a000000-0000-4000-8000-000000000001', 'Custom MSP B');
insert into public.invitations (email, role, msp_id, invited_by, expires_at) values
  ('custom-a@example.test', 'msp_owner', '4b000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', now() + interval '1 day'),
  ('custom-b@example.test', 'msp_owner', '4b000000-0000-4000-8000-000000000002', 'a7000000-0000-4000-8000-000000000001', now() + interval '1 day');
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a7000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custom-a@example.test', now(), '{}', '{}', now(), now()),
  ('a7000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custom-b@example.test', now(), '{}', '{}', now(), now());

create temporary table picked on commit drop as
select
  (select ct.id from public.cohort_tasks ct join public.cohort_weeks cw on cw.id = ct.cohort_week_id
   where ct.cohort_id = '4a000000-0000-4000-8000-000000000001' and cw.week_number = 1 and ct.position = 2) as hidden_task,
  (select id from public.cohort_weeks where cohort_id = '4a000000-0000-4000-8000-000000000001' and week_number = 1) as week_one;
grant select on picked to authenticated;

-- Hide one program task for A and add an extra Week 1 task for A.
insert into public.msp_hidden_tasks (msp_id, cohort_task_id, hidden_by)
values ('4b000000-0000-4000-8000-000000000001', (select hidden_task from picked), 'a7000000-0000-4000-8000-000000000001');
insert into public.cohort_tasks (id, cohort_id, cohort_week_id, msp_id, position, title, owner_label, owner_type)
values ('4c000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', (select week_one from picked),
        '4b000000-0000-4000-8000-000000000001', 8, 'Extra for A', 'MSP IT admin', 'msp');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*) from public.cohort_tasks where id = (select hidden_task from picked)), 0::bigint, 'A no longer sees the task hidden for A');
select is((select count(*) from public.cohort_tasks where id = '4c000000-0000-4000-8000-000000000001'), 1::bigint, 'A sees its extra task');
select is(
  (select overall_total_tasks from public.msp_progress where msp_id = '4b000000-0000-4000-8000-000000000001' limit 1),
  30,
  'A''s total is 30: one program task hidden, one extra task added'
);
select throws_ok(
  $$ insert into public.msp_hidden_tasks (msp_id, cohort_task_id, hidden_by)
     select '4b000000-0000-4000-8000-000000000001', ct.id, 'a7000000-0000-4000-8000-000000000002'
     from public.cohort_tasks ct join public.cohort_weeks cw on cw.id = ct.cohort_week_id
     where ct.cohort_id = '4a000000-0000-4000-8000-000000000001' and cw.week_number = 1 and ct.position = 3 $$,
  '42501',
  null,
  'An MSP cannot change its own checklist'
);

select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*) from public.cohort_tasks where id = (select hidden_task from picked)), 1::bigint, 'B still sees the program task hidden only for A');
select is((select count(*) from public.cohort_tasks where id = '4c000000-0000-4000-8000-000000000001'), 0::bigint, 'B does not see A''s extra task');
select is(
  (select overall_total_tasks from public.msp_progress where msp_id = '4b000000-0000-4000-8000-000000000002' limit 1),
  30,
  'B''s total is unchanged'
);

-- Archiving the extra task removes it from A's checklist.
set local role postgres;
update public.cohort_tasks set archived_at = now() where id = '4c000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
select is(
  (select overall_total_tasks from public.msp_progress where msp_id = '4b000000-0000-4000-8000-000000000001' limit 1),
  29,
  'An archived extra task leaves A''s checklist and progress'
);

select * from finish();
rollback;
