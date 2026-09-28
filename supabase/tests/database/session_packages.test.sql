begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

set local role postgres;

insert into public.admin_allowlist (email) values ('package-admin@lemhi.com')
on conflict (email) do update set active = true;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('a5000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'package-admin@lemhi.com', now(), '{}', '{}', now(), now());

insert into public.cohorts (id, program_id, name, start_date, timezone, session_weekday, session_time)
values ('45000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Package cohort',
        '2026-09-28', 'America/New_York', 1, '11:00');

insert into public.msps (id, cohort_id, name) values
  ('46000000-0000-4000-8000-000000000001', '45000000-0000-4000-8000-000000000001', 'Package MSP A'),
  ('46000000-0000-4000-8000-000000000002', '45000000-0000-4000-8000-000000000001', 'Package MSP B');

insert into public.invitations (email, role, msp_id, invited_by, expires_at) values
  ('package-a@example.test', 'msp_owner', '46000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', now() + interval '1 day'),
  ('package-b@example.test', 'msp_owner', '46000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000001', now() + interval '1 day');

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a5000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'package-a@example.test', now(), '{}', '{}', now(), now()),
  ('a5000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'package-b@example.test', now(), '{}', '{}', now(), now());

-- As the admin, create a 1:1 for MSP A at 2 PM Eastern.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a5000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);

create temporary table created_session on commit drop as
select public.create_one_on_one_session('46000000-0000-4000-8000-000000000001', '2026-10-06 14:00', '1:1 with Package MSP A') as id;
grant select on created_session to authenticated;

select is(
  (select row(s.kind, s.msp_id, s.cohort_id, s.week_number) from public.sessions s where s.id = (select id from created_session)),
  row('one_on_one'::public.session_kind, '46000000-0000-4000-8000-000000000001'::uuid, '45000000-0000-4000-8000-000000000001'::uuid, null::smallint),
  'An admin creates a 1:1 session for the MSP in its cohort'
);

select is(
  (select starts_at from public.sessions where id = (select id from created_session)),
  '2026-10-06 18:00:00+00'::timestamptz,
  'The call time is read in the cohort time zone (2 PM Eastern is 18:00 UTC)'
);

-- MSP A sees its own 1:1; MSP B does not.
select set_config('request.jwt.claims', json_build_object('sub', 'a5000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*) from public.sessions where id = (select id from created_session)), 1::bigint, 'The MSP can read its own 1:1 session');

select throws_ok(
  $$ select public.create_one_on_one_session('46000000-0000-4000-8000-000000000001', '2026-10-06 14:00', 'Not allowed') $$,
  'P0001',
  'Only Lemhi admins can create 1:1 sessions',
  'An MSP user cannot create a 1:1 session'
);

select set_config('request.jwt.claims', json_build_object('sub', 'a5000000-0000-4000-8000-000000000003', 'role', 'authenticated')::text, true);
select is((select count(*) from public.sessions where id = (select id from created_session)), 0::bigint, 'Another MSP cannot read that 1:1 session');

-- Session-linked assets must match the session's audience.
set local role postgres;

select throws_ok(
  $$
    insert into public.assets (title, category, kind, status, external_url, scope, msp_id, session_id)
    values ('Wrong MSP', 'transcript', 'link', 'ready', 'https://example.test', 'msp',
            '46000000-0000-4000-8000-000000000002', (select id from created_session))
  $$,
  'P0001',
  'Session does not match asset scope',
  'A 1:1 file cannot be shared with a different MSP'
);

select throws_ok(
  $$
    insert into public.assets (title, category, kind, status, external_url, scope, cohort_id, session_id)
    values ('1:1 to cohort', 'transcript', 'link', 'ready', 'https://example.test', 'cohort',
            '45000000-0000-4000-8000-000000000001', (select id from created_session))
  $$,
  'P0001',
  'Session does not match asset scope',
  'A 1:1 file cannot be shared with the whole cohort'
);

select lives_ok(
  $$
    insert into public.assets (title, category, kind, status, external_url, scope, msp_id, session_id)
    values ('Right MSP', 'transcript', 'link', 'ready', 'https://example.test', 'msp',
            '46000000-0000-4000-8000-000000000001', (select id from created_session))
  $$,
  'A 1:1 file can be shared with its own MSP'
);

select lives_ok(
  $$
    insert into public.assets (title, category, kind, status, external_url, scope, cohort_id, session_id, cohort_week_id)
    values ('Group recording', 'recording', 'link', 'ready', 'https://example.test', 'cohort',
            '45000000-0000-4000-8000-000000000001',
            (select id from public.sessions where cohort_id = '45000000-0000-4000-8000-000000000001' and kind = 'group' and week_number = 1),
            (select id from public.cohort_weeks where cohort_id = '45000000-0000-4000-8000-000000000001' and week_number = 1))
  $$,
  'A group session file can be shared with its cohort and attached to its week'
);

select * from finish();
rollback;
