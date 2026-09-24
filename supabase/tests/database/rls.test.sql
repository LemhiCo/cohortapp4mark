begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

set local role postgres;

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a3000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo-11111111111111111111@lemhi.com',
  now(),
  '{}'::jsonb,
  '{"demo_access":true,"full_name":"Lemhi Demo Viewer"}'::jsonb,
  now(),
  now()
);

select is(
  (select role from public.profiles where id = 'a3000000-0000-4000-8000-000000000001'),
  'msp_member'::public.app_role,
  'The flagged shared demo user receives MSP member access only'
);

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      'a3000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'spoofed@lemhi.com',
      now(),
      '{}'::jsonb,
      '{}',
      now(),
      now()
    )
  $$,
  'P0001',
  null,
  'Typing a Lemhi address cannot create an arbitrary privileged auth user'
);

insert into public.admin_allowlist (email)
values ('rls-admin@lemhi.com')
on conflict (email) do update set active = true;

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a0000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'rls-admin@lemhi.com',
  now(),
  '{}'::jsonb,
  '{"full_name":"RLS Admin"}'::jsonb,
  now(),
  now()
);

insert into public.cohorts (
  id, program_id, name, start_date, timezone, session_weekday, session_time
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'RLS Cohort A',
    current_date,
    'America/New_York',
    1,
    '11:00'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'RLS Cohort B',
    current_date,
    'America/New_York',
    2,
    '13:00'
  );

update public.cohorts
set lead_id = 'a0000000-0000-4000-8000-000000000001'
where id in (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002'
);

insert into public.msps (id, cohort_id, name, website)
values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'MSP A', 'https://a.example'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'MSP B', 'https://b.example'),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'MSP C', 'https://c.example');

insert into public.invitations (id, email, role, msp_id, invited_by)
values
  ('32000000-0000-4000-8000-000000000001', 'owner-a@example.com', 'msp_owner', '31000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('32000000-0000-4000-8000-000000000002', 'owner-b@example.com', 'msp_owner', '31000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('32000000-0000-4000-8000-000000000003', 'owner-c@example.com', 'msp_owner', '31000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001');

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.com', now(), '{}'::jsonb, '{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.com', now(), '{}'::jsonb, '{"full_name":"Owner B"}'::jsonb, now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-c@example.com', now(), '{}'::jsonb, '{"full_name":"Owner C"}'::jsonb, now(), now());

insert into public.assets (
  id, title, category, kind, status, external_url, scope, program_id, cohort_id, msp_id, created_by
)
values
  ('33000000-0000-4000-8000-000000000001', 'Program asset', 'documentation', 'link', 'ready', 'https://example.com/program', 'program', '10000000-0000-4000-8000-000000000001', null, null, 'a0000000-0000-4000-8000-000000000001'),
  ('33000000-0000-4000-8000-000000000002', 'Cohort A asset', 'documentation', 'link', 'ready', 'https://example.com/cohort-a', 'cohort', null, '30000000-0000-4000-8000-000000000001', null, 'a0000000-0000-4000-8000-000000000001'),
  ('33000000-0000-4000-8000-000000000003', 'MSP A asset', 'documentation', 'link', 'ready', 'https://example.com/msp-a', 'msp', null, null, '31000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('33000000-0000-4000-8000-000000000004', 'MSP B asset', 'documentation', 'link', 'ready', 'https://example.com/msp-b', 'msp', null, null, '31000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('33000000-0000-4000-8000-000000000005', 'Cohort B asset', 'documentation', 'link', 'ready', 'https://example.com/cohort-b', 'cohort', null, '30000000-0000-4000-8000-000000000002', null, 'a0000000-0000-4000-8000-000000000001');

insert into public.assets (
  id, title, category, kind, status, storage_path, mime_type, scope, msp_id, created_by
)
values (
  '33000000-0000-4000-8000-000000000006',
  'MSP B private file',
  'documentation',
  'file',
  'ready',
  'msp/31000000-0000-4000-8000-000000000002/private.pdf',
  'application/pdf',
  'msp',
  '31000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.task_completions (msp_id, cohort_task_id, completed_by)
select
  test_case.msp_id,
  task.id,
  test_case.user_id
from (
  values
    ('31000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid),
    ('31000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid),
    ('31000000-0000-4000-8000-000000000003'::uuid, '30000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid)
) as test_case(msp_id, cohort_id, user_id)
join public.cohort_tasks task
  on task.cohort_id = test_case.cohort_id
  and task.template_task_id = '12000000-0000-4000-8000-000000000001';

insert into public.task_notes (msp_id, cohort_task_id, author_id, body)
select
  test_case.msp_id,
  task.id,
  test_case.user_id,
  test_case.body
from (
  values
    ('31000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 'Note for MSP A'),
    ('31000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid, 'Note for MSP B'),
    ('31000000-0000-4000-8000-000000000003'::uuid, '30000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid, 'Note for MSP C')
) as test_case(msp_id, cohort_id, user_id, body)
join public.cohort_tasks task
  on task.cohort_id = test_case.cohort_id
  and task.template_task_id = '12000000-0000-4000-8000-000000000001';

select is(
  (select status from public.invitations where email = 'owner-a@example.com'),
  'pending'::public.invitation_status,
  'An invited user stays pending until first sign-in'
);

select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      'a2000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'uninvited@example.com',
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  $$,
  'P0001',
  null,
  'An uninvited external user cannot be provisioned'
);

insert into public.admin_allowlist (email) values ('outside@example.com');
select throws_ok(
  $$
    insert into auth.users (
      id, instance_id, aud, role, email, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      'a2000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'outside@example.com',
      now(),
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  $$,
  'P0001',
  null,
  'The admin allow-list cannot grant admin access outside lemhi.com'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);

select is(
  (select count(*) from public.assets where id::text like '33000000-%'),
  3::bigint,
  'MSP A sees program, cohort A, and MSP A test assets only'
);
select is(public.can_access_asset_path('msp/31000000-0000-4000-8000-000000000002/private.pdf'), false, 'MSP A cannot sign a URL for MSP B private file');
select is((select count(*) from public.msps), 1::bigint, 'MSP A reads only its own full MSP row');
select is((select count(*) from public.cohort_peers), 1::bigint, 'MSP A sees only the other company in its cohort through the peer view');
select columns_are(
  'public',
  'cohort_peers',
  array['id', 'name', 'website', 'logo_path'],
  'Peer view exposes no user or contact fields'
);
select is((select count(*) from public.profiles), 1::bigint, 'MSP A cannot read MSP B or another cohort profiles');
select is((select count(*) from public.task_notes), 1::bigint, 'MSP A cannot read another MSP task notes');
select is((select count(*) from public.task_completions), 1::bigint, 'MSP A cannot read another MSP task completions');
select is((select count(*) from public.cohorts), 1::bigint, 'MSP A reads only its cohort');
select is((select count(*) from public.cohort_leads), 1::bigint, 'MSP A sees only its assigned cohort lead');
select is((select count(*) from public.sessions), 4::bigint, 'MSP A reads only its cohort group sessions');
select is((select count(*) from public.cohort_tasks), 30::bigint, 'MSP A reads only its visible cohort tasks');
select is((select count(*) from public.msp_progress), 4::bigint, 'MSP A receives four progress rows for itself only');

select lives_ok(
  $$
    insert into public.task_completions (msp_id, cohort_task_id, completed_by)
    select
      '31000000-0000-4000-8000-000000000001',
      id,
      'a1000000-0000-4000-8000-000000000001'
    from public.cohort_tasks
    where template_task_id = '12000000-0000-4000-8000-000000000002'
  $$,
  'MSP A can complete an MSP-owned task in its active cohort'
);

select throws_ok(
  $$
    insert into public.task_completions (msp_id, cohort_task_id, completed_by)
    select
      '31000000-0000-4000-8000-000000000001',
      id,
      'a1000000-0000-4000-8000-000000000001'
    from public.cohort_tasks
    where template_task_id = '12000000-0000-4000-8000-000000000004'
  $$,
  '42501',
  null,
  'MSP A cannot complete a Lemhi-owned task'
);

select throws_ok(
  $$
    insert into public.task_completions (msp_id, cohort_task_id, completed_by)
    select
      '31000000-0000-4000-8000-000000000002',
      id,
      'a1000000-0000-4000-8000-000000000001'
    from public.cohort_tasks
    where template_task_id = '12000000-0000-4000-8000-000000000003'
  $$,
  'P0001',
  null,
  'MSP A cannot complete a task for MSP B'
);

select lives_ok(
  $$
    insert into public.invitations (email, role, msp_id, invited_by)
    values (
      'member-a@example.com',
      'msp_member',
      '31000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001'
    )
  $$,
  'MSP A owner can invite a member to its own team'
);

select throws_ok(
  $$
    insert into public.invitations (email, role, msp_id, invited_by)
    values (
      'intruder@example.com',
      'msp_member',
      '31000000-0000-4000-8000-000000000002',
      'a1000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  null,
  'MSP A owner cannot invite a member to MSP B'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select is(
  (select count(*) from public.assets where id::text like '33000000-%'),
  6::bigint,
  'Lemhi admin reads test assets across all scopes and cohorts'
);

select lives_ok(
  $$
    select public.update_group_session_local(
      (select id from public.sessions where cohort_id = '30000000-0000-4000-8000-000000000001' and week_number = 1),
      '2026-10-05 10:30'::timestamp,
      'Admin-edited cohort session',
      'https://meet.example.com/cohort-a'
    )
  $$,
  'Lemhi admin can update a group session using cohort-local time'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select throws_ok(
  $$
    select public.update_group_session_local(
      (select id from public.sessions where cohort_id = '30000000-0000-4000-8000-000000000001' and week_number = 1),
      '2026-10-05 10:30'::timestamp,
      'Unauthorized edit',
      null
    )
  $$,
  'P0001',
  null,
  'MSP users cannot use the admin session editor'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);

update public.cohorts
set status_override = 'ended'
where id = '30000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select throws_ok(
  $$
    insert into public.task_completions (msp_id, cohort_task_id, completed_by)
    select
      '31000000-0000-4000-8000-000000000001',
      id,
      'a1000000-0000-4000-8000-000000000001'
    from public.cohort_tasks
    where template_task_id = '12000000-0000-4000-8000-000000000003'
  $$,
  '42501',
  null,
  'MSP A cannot complete tasks after its cohort ends'
);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
update public.msps set status = 'deactivated' where id = '31000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a1000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  true
);
select is((select count(*) from public.programs), 0::bigint, 'A deactivated MSP cannot read program data');
select is((select count(*) from public.assets), 0::bigint, 'A deactivated MSP cannot read assets');

select * from finish();
rollback;
