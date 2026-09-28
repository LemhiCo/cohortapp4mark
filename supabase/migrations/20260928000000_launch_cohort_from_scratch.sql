-- Launch Cohort 1 from a clean slate.
--
-- The demo walkthrough cohort and its four MSP portals are now the real launch
-- cohort, so the fixed IDs the demo code targeted belong to real customers.
-- This migration removes every demo path that could still reach them and clears
-- the demo activity, keeping the 19 program starter assets, the four MSP
-- portals, their owner accounts and Mark's admin account.

-- Sign-up only creates profiles for allow-listed Lemhi admins and invited MSP
-- users. The demo identity branches are gone: the demo MSP ID is Northstar's
-- real portal, and a crafted demo-*@lemhi.com address must never attach to it.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited public.invitations%rowtype;
begin
  if new.email is null then
    raise exception 'An email address is required';
  end if;

  if lower(new.email) like '%@lemhi.com'
    and exists (
      select 1 from public.admin_allowlist a
      where a.email = new.email and a.active
    ) then
    insert into public.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'lemhi_admin'
    );
    return new;
  end if;

  select * into invited
  from public.invitations i
  where i.email = new.email
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if invited.id is null then
    raise exception 'This email address has not been invited';
  end if;

  insert into public.profiles (id, email, full_name, role, msp_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    invited.role,
    invited.msp_id
  );

  update public.invitations
  set auth_user_id = new.id
  where id = invited.id;

  return new;
end;
$$;

-- These rewrite the launch cohort's name, dates, assets and progress when run.
drop function if exists public.seed_demo_progress();
drop function if exists public.seed_demo_content();

do $$
declare
  launch_cohort_id constant uuid := '20000000-0000-4000-8000-000000000001';
  mark_id uuid;
  demo_ids uuid[];
begin
  select array_agg(u.id) into demo_ids
  from auth.users u
  where lower(u.email) ~ '^demo-(admin|client|[a-f0-9]{20})@lemhi[.]com$';

  select p.id into mark_id
  from public.profiles p
  where p.email = 'mark.creighton@lemhi.com'
    and p.role = 'lemhi_admin'
    and p.active;

  -- Demo users own invitations and completions through RESTRICT foreign keys,
  -- so they can only be removed once there is a real admin to reassign to.
  if demo_ids is not null and mark_id is null then
    raise exception 'Create Mark''s admin account before removing the demo identities';
  end if;

  if mark_id is not null then
    update public.profiles
    set full_name = 'Mark Creighton',
        title = 'Head of Success',
        photo_path = null
    where id = mark_id;
  end if;

  -- Only convert the cohort while it is still the demo cohort. Production
  -- migrations have been applied by hand, so a later `supabase db push` may
  -- replay this file; after launch that must never wipe real progress.
  if exists (
    select 1 from public.cohorts
    where id = launch_cohort_id and name = 'Fall 2026 Demo Cohort'
  ) then
    update public.cohorts
    set name = 'Cohort 1',
        start_date = '2026-09-28',
        status_override = null,
        lead_id = coalesce(mark_id, lead_id)
    where id = launch_cohort_id;

    -- Same formula as bootstrap_cohort(), so the four sessions follow the new
    -- start date on the cohort's weekday, time and time zone.
    update public.sessions s
    set starts_at = (
      (
        c.start_date
        + ((c.session_weekday - extract(dow from c.start_date)::integer + 7) % 7)
        + ((s.week_number - 1) * 7)
        + c.session_time
      ) at time zone c.timezone
    )
    from public.cohorts c
    where s.cohort_id = c.id
      and c.id = launch_cohort_id
      and s.kind = 'group';

    update public.msps
    set website = null
    where cohort_id = launch_cohort_id
      and website = 'https://example.com';

    delete from public.task_completions
    where msp_id in (select id from public.msps where cohort_id = launch_cohort_id);

    delete from public.task_notes
    where msp_id in (select id from public.msps where cohort_id = launch_cohort_id);

    delete from public.activity_events
    where msp_id in (select id from public.msps where cohort_id = launch_cohort_id);

    update public.profiles
    set last_seen_at = null
    where msp_id in (select id from public.msps where cohort_id = launch_cohort_id);
  end if;

  if demo_ids is not null then
    update public.invitations set invited_by = mark_id where invited_by = any (demo_ids);
    update public.assets set created_by = mark_id where created_by = any (demo_ids);
    update public.cohorts set lead_id = mark_id where lead_id = any (demo_ids);
    delete from public.msp_hidden_tasks where hidden_by = any (demo_ids);
    delete from public.task_completions where completed_by = any (demo_ids);
    delete from public.task_notes where author_id = any (demo_ids);

    -- Cascades to their profiles, activity, sessions and refresh tokens, which
    -- also signs out any browser still holding a demo session.
    delete from auth.users where id = any (demo_ids);
  end if;
end;
$$;
