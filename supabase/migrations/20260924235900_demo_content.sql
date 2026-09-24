-- Demo content for the first team walkthrough. The fixed IDs make this safe to
-- apply once in production and reproduce locally without creating duplicates.

create or replace function public.seed_demo_content()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- On a clean reset the program template is added by seed.sql after migrations.
  -- The seed calls this function again once the template exists.
  if not exists (
    select 1
    from public.programs
    where id = '10000000-0000-4000-8000-000000000001'
  ) then
    return;
  end if;

insert into public.cohorts (
  id,
  program_id,
  name,
  start_date,
  timezone,
  session_weekday,
  session_time,
  status_override
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Fall 2026 Demo Cohort',
  '2026-09-21',
  'America/New_York',
  1,
  '11:00',
  'active'
)
on conflict (id) do update set
  name = excluded.name,
  start_date = excluded.start_date,
  timezone = excluded.timezone,
  session_weekday = excluded.session_weekday,
  session_time = excluded.session_time,
  status_override = excluded.status_override;

insert into public.msps (id, cohort_id, name, website)
values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Northstar Managed IT', 'https://example.com'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Harbor Ridge Technology', 'https://example.com'),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'BluePeak Networks', 'https://example.com'),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'SummitDesk Solutions', 'https://example.com')
on conflict (id) do update set
  name = excluded.name,
  website = excluded.website;

update public.sessions
set join_url = 'https://meet.google.com',
    title = case week_number
      when 1 then 'Week 1 · Launch and onboarding'
      when 2 then 'Week 2 · Build the client motion'
      when 3 then 'Week 3 · Activate with live accounts'
      when 4 then 'Week 4 · Scale the operating rhythm'
      else title
    end
where cohort_id = '20000000-0000-4000-8000-000000000001'
  and kind = 'group';

insert into public.assets (
  id,
  title,
  category,
  kind,
  status,
  external_url,
  scope,
  program_id,
  program_week_id,
  summary,
  action_items
)
values
  (
    '22000000-0000-4000-8000-000000000001',
    'Cohort roadmap and kickoff guide',
    'documentation',
    'link',
    'ready',
    'https://example.com',
    'program',
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'A demo guide to the four-week cohort cadence, roles, and expected outcomes.',
    '["Confirm the internal cohort team", "Choose the tenant setup owner"]'::jsonb
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    'Ideal client profile worksheet',
    'marketing_asset',
    'link',
    'ready',
    'https://example.com',
    'program',
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    'A demo worksheet for narrowing the first set of target accounts.',
    '["Define the starting client profile", "Select five target accounts"]'::jsonb
  ),
  (
    '22000000-0000-4000-8000-000000000003',
    'Client conversation playbook',
    'marketing_asset',
    'link',
    'ready',
    'https://example.com',
    'program',
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000003',
    'Example positioning, discovery questions, and next-step language for a client conversation.',
    '["Practice the opening", "Capture objections and client language"]'::jsonb
  ),
  (
    '22000000-0000-4000-8000-000000000004',
    'Post-cohort operating rhythm',
    'documentation',
    'link',
    'ready',
    'https://example.com',
    'program',
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000004',
    'A demo template for owners, handoffs, metrics, and the ongoing review cadence.',
    '["Set the next review date", "Share the final workflow internally"]'::jsonb
  )
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  action_items = excluded.action_items;

insert into public.assets (
  id,
  title,
  category,
  kind,
  status,
  external_url,
  scope,
  cohort_id,
  summary,
  action_items
)
values
  (
    '22000000-0000-4000-8000-000000000005',
    'Week 1 session recording (demo)',
    'recording',
    'link',
    'ready',
    'https://example.com',
    'cohort',
    '20000000-0000-4000-8000-000000000001',
    'Demo recording entry showing how same-day session playback will appear in the library.',
    '["Review the tenant setup decisions", "Confirm owners before Week 2"]'::jsonb
  ),
  (
    '22000000-0000-4000-8000-000000000006',
    'Week 1 session summary',
    'transcript',
    'link',
    'ready',
    'https://example.com',
    'cohort',
    '20000000-0000-4000-8000-000000000001',
    'The cohort aligned on success measures, owners, and the Week 1 setup sequence.',
    '["Finish platform access", "Bring the first target-account list to Week 2"]'::jsonb
  )
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  action_items = excluded.action_items;

insert into public.assets (
  id,
  title,
  category,
  kind,
  status,
  external_url,
  scope,
  msp_id,
  summary,
  action_items
)
values (
  '22000000-0000-4000-8000-000000000007',
  'Northstar working action plan',
  'documentation',
  'link',
  'ready',
  'https://example.com',
  'msp',
  '21000000-0000-4000-8000-000000000001',
  'A private demo resource visible only to the Northstar portal and Lemhi admins.',
  '["Assign the assessment owner", "Schedule two client conversations"]'::jsonb
)
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  action_items = excluded.action_items;

end;
$$;

revoke all on function public.seed_demo_content() from public, anon, authenticated;

select public.seed_demo_content();
