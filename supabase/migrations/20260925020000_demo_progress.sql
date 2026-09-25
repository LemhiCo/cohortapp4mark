-- Fleshes out the demo cohort for the team walkthrough: real progress instead
-- of an all-zero checklist, a second MSP that is visibly behind schedule, an
-- assigned cohort lead, a couple of task notes, and two more library assets.
-- Safe to re-run: every insert is guarded so this never duplicates rows.

create or replace function public.seed_demo_progress()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_cohort_id uuid := '20000000-0000-4000-8000-000000000001';
  northstar_id uuid := '21000000-0000-4000-8000-000000000001';
  harbor_ridge_id uuid := '21000000-0000-4000-8000-000000000002';
  demo_admin_id uuid;
  demo_client_id uuid;
  roadmap_task_id uuid;
begin
  if not exists (select 1 from public.cohorts where id = demo_cohort_id) then
    return;
  end if;

  -- Move the cohort a week earlier so "today" lands in Week 2, which gives a
  -- real past week to be caught up on (or behind on) instead of everything
  -- sitting in an untouched Week 1. Sessions are recomputed with the same
  -- formula the cohort-creation trigger uses, so the schedule stays in sync.
  update public.cohorts
  set start_date = '2026-09-14'
  where id = demo_cohort_id
    and start_date <> '2026-09-14';

  update public.sessions s
  set starts_at = (
    (
      c.start_date + ((c.session_weekday - extract(dow from c.start_date)::integer + 7) % 7)
      + ((s.week_number - 1) * 7)
      + c.session_time
    ) at time zone c.timezone
  )
  from public.cohorts c
  where s.cohort_id = c.id
    and c.id = demo_cohort_id
    and s.kind = 'group';

  -- Assign a lead once the demo admin identity exists (created the first time
  -- anyone uses the "switch to admin view" toggle, or manually via the
  -- fixed-email trigger). Harmless no-op until then.
  select id into demo_admin_id from public.profiles where email = 'demo-admin@lemhi.com';
  select id into demo_client_id from public.profiles where email = 'demo-client@lemhi.com';

  if demo_admin_id is not null then
    update public.profiles
    set title = 'Head of Customer Success'
    where id = demo_admin_id
      and title is distinct from 'Head of Customer Success';

    update public.cohorts
    set lead_id = demo_admin_id
    where id = demo_cohort_id
      and lead_id is distinct from demo_admin_id;
  end if;

  -- Northstar: fully caught up through the now-past Week 1, and already
  -- chipping away at the current week.
  insert into public.task_completions (msp_id, cohort_task_id, completed_by, completed_at)
  select
    northstar_id,
    ct.id,
    coalesce(
      case when ct.owner_type = 'lemhi' or ct.kind = 'checkpoint' then demo_admin_id else demo_client_id end,
      demo_admin_id,
      demo_client_id
    ),
    now() - interval '8 days' + (ct.position || ' hours')::interval
  from public.cohort_tasks ct
  join public.cohort_weeks cw on cw.id = ct.cohort_week_id
  where ct.cohort_id = demo_cohort_id
    and cw.week_number = 1
    and ct.archived_at is null
    and (ct.msp_id is null or ct.msp_id = northstar_id)
    and (demo_admin_id is not null or demo_client_id is not null)
  on conflict (msp_id, cohort_task_id) do nothing;

  insert into public.task_completions (msp_id, cohort_task_id, completed_by, completed_at)
  select
    northstar_id,
    ct.id,
    demo_client_id,
    now() - interval '1 day' + (ct.position || ' hours')::interval
  from public.cohort_tasks ct
  join public.cohort_weeks cw on cw.id = ct.cohort_week_id
  where ct.cohort_id = demo_cohort_id
    and cw.week_number = 2
    and ct.archived_at is null
    and ct.owner_type = 'msp'
    and ct.kind = 'task'
    and (ct.msp_id is null or ct.msp_id = northstar_id)
    and ct.position <= (
      select min(position) + 1
      from public.cohort_tasks ct2
      join public.cohort_weeks cw2 on cw2.id = ct2.cohort_week_id
      where ct2.cohort_id = demo_cohort_id and cw2.week_number = 2 and ct2.owner_type = 'msp'
    )
    and demo_client_id is not null
  on conflict (msp_id, cohort_task_id) do nothing;

  -- Harbor Ridge: behind on Week 1 (everything done except the closing
  -- checkpoint, which only Lemhi can clear) and hasn't touched Week 2 yet.
  insert into public.task_completions (msp_id, cohort_task_id, completed_by, completed_at)
  select
    harbor_ridge_id,
    ct.id,
    demo_admin_id,
    now() - interval '9 days' + (ct.position || ' hours')::interval
  from public.cohort_tasks ct
  join public.cohort_weeks cw on cw.id = ct.cohort_week_id
  where ct.cohort_id = demo_cohort_id
    and cw.week_number = 1
    and ct.archived_at is null
    and ct.kind <> 'checkpoint'
    and (ct.msp_id is null or ct.msp_id = harbor_ridge_id)
    and demo_admin_id is not null
  on conflict (msp_id, cohort_task_id) do nothing;

  -- A short note thread on the first Week 1 task, visible to Northstar.
  select ct.id into roadmap_task_id
  from public.cohort_tasks ct
  join public.cohort_weeks cw on cw.id = ct.cohort_week_id
  where ct.cohort_id = demo_cohort_id
    and cw.week_number = 1
    and ct.owner_type = 'msp'
    and ct.archived_at is null
  order by ct.position
  limit 1;

  if roadmap_task_id is not null and demo_client_id is not null and demo_admin_id is not null
    and not exists (
      select 1 from public.task_notes
      where msp_id = northstar_id and cohort_task_id = roadmap_task_id
    ) then
    insert into public.task_notes (msp_id, cohort_task_id, author_id, body, created_at)
    values
      (
        northstar_id,
        roadmap_task_id,
        demo_client_id,
        'Tenant is set up and our two admins have access. Anything else you need from us before the next session?',
        now() - interval '7 days'
      ),
      (
        northstar_id,
        roadmap_task_id,
        demo_admin_id,
        'That covers it — nice work getting ahead of this. See you at the session.',
        now() - interval '6 days'
      );
  end if;

  -- A second week of recordings in the library, matching the same-day
  -- upload pattern the Week 1 assets already show.
  insert into public.assets (
    id, title, category, kind, status, external_url, scope, cohort_id, summary, action_items
  )
  values
    (
      '22000000-0000-4000-8000-000000000008',
      'Week 2 session recording (demo)',
      'recording',
      'link',
      'ready',
      'https://example.com',
      'cohort',
      demo_cohort_id,
      'Demo recording entry for the Week 2 group session on positioning and targeting.',
      '["Finalize the target account list", "Book the first client conversations"]'::jsonb
    ),
    (
      '22000000-0000-4000-8000-000000000009',
      'Week 2 session summary',
      'transcript',
      'link',
      'ready',
      'https://example.com',
      'cohort',
      demo_cohort_id,
      'The cohort worked through ideal client profiles and drafted first-outreach messaging.',
      '["Send the first round of outreach", "Log responses before Week 3"]'::jsonb
    )
  on conflict (id) do update set
    title = excluded.title,
    summary = excluded.summary,
    action_items = excluded.action_items;
end;
$$;

revoke all on function public.seed_demo_progress() from public, anon, authenticated;

select public.seed_demo_progress();
