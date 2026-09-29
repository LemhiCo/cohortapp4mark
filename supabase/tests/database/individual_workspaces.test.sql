begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

set local role postgres;

insert into public.admin_allowlist (email) values ('individual-admin@lemhi.com')
on conflict (email) do update set active = true;
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'aa000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'individual-admin@lemhi.com', now(),
  '{}', '{"full_name":"Individual Admin"}', now(), now()
);

insert into public.cohorts (
  id, program_id, name, start_date, timezone, session_weekday, session_time,
  lead_id, workspace_type
) values (
  '51000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Independent test workspace',
  (now() at time zone 'America/New_York')::date - 45,
  'America/New_York', 1, '11:00',
  'aa000000-0000-4000-8000-000000000001',
  'individual'
);

insert into public.cohorts (
  id, program_id, name, start_date, timezone, session_weekday, session_time, lead_id
) values (
  '51000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'Default cohort workspace',
  (now() at time zone 'America/New_York')::date,
  'America/New_York', 1, '11:00',
  'aa000000-0000-4000-8000-000000000001'
);

insert into public.msps (id, cohort_id, name)
values ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Independent MSP');

select is(
  (select workspace_type from public.cohorts where id = '51000000-0000-4000-8000-000000000002'),
  'cohort',
  'Existing cohorts default to the cohort workspace type'
);
select is(
  (select count(*) from public.cohort_weeks where cohort_id = '51000000-0000-4000-8000-000000000001'),
  4::bigint,
  'An independent workspace receives all four roadmap stages'
);
select is(
  (select count(*) from public.cohort_tasks where cohort_id = '51000000-0000-4000-8000-000000000001'),
  30::bigint,
  'An independent workspace receives the full task roadmap'
);
select is(
  (select count(*) from public.sessions where cohort_id = '51000000-0000-4000-8000-000000000001'),
  0::bigint,
  'An independent workspace does not generate group sessions'
);
select is(
  public.effective_cohort_status('51000000-0000-4000-8000-000000000001'),
  'active'::public.cohort_status,
  'An independent program remains active after four weeks'
);
select is(
  public.cohort_current_week('51000000-0000-4000-8000-000000000001'),
  4::smallint,
  'An independent program stays on its final stage instead of ending'
);
select throws_ok(
  $$
    insert into public.msps (cohort_id, name)
    values ('51000000-0000-4000-8000-000000000001', 'Second Independent MSP')
  $$,
  'P0001',
  'An individual workspace can contain only one MSP',
  'A second MSP cannot be placed into the same individual workspace'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aa000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);

create temporary table created_workspace on commit drop as
select * from public.create_individual_workspace(
  'RPC Independent MSP',
  'https://rpc-independent.example',
  (now() at time zone 'America/New_York')::date,
  'America/New_York',
  'aa000000-0000-4000-8000-000000000001'
);
grant select on created_workspace to authenticated;

select is(
  (select count(*) from created_workspace),
  1::bigint,
  'The admin RPC atomically creates one workspace and MSP pair'
);
select is(
  (select c.workspace_type from public.cohorts c join created_workspace w on w.cohort_id = c.id),
  'individual',
  'The admin RPC marks the new workspace as individual'
);
select is(
  (select count(*) from public.sessions s join created_workspace w on w.cohort_id = s.cohort_id),
  0::bigint,
  'The RPC-created individual workspace also has no group sessions'
);

select * from finish();
rollback;
