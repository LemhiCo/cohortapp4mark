-- Support MSPs that follow the program independently rather than as members
-- of a shared cohort. Each independent MSP receives its own one-company
-- workspace so the existing task, progress, asset, and RLS model stays intact.

alter table public.cohorts
  add column workspace_type text not null default 'cohort'
  check (workspace_type in ('cohort', 'individual'));

create index cohorts_workspace_type_idx on public.cohorts (workspace_type, start_date desc);

create or replace function public.bootstrap_cohort()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  first_session_date date;
begin
  insert into public.cohort_weeks (
    cohort_id, template_week_id, week_number, title, subtitle, goal
  )
  select new.id, w.id, w.week_number, w.title, w.subtitle, w.goal
  from public.program_weeks w
  where w.program_id = new.program_id
  order by w.week_number;

  insert into public.cohort_tasks (
    cohort_id, cohort_week_id, template_task_id, position, title, description,
    owner_label, owner_type, kind, archived_at
  )
  select
    new.id, cw.id, t.id, t.position, t.title, t.description,
    t.owner_label, t.owner_type, t.kind, t.archived_at
  from public.program_tasks t
  join public.program_weeks pw on pw.id = t.week_id
  join public.cohort_weeks cw
    on cw.cohort_id = new.id and cw.template_week_id = pw.id
  where t.program_id = new.program_id
  order by pw.week_number, t.position;

  if new.workspace_type = 'cohort' then
    first_session_date := new.start_date + ((new.session_weekday - extract(dow from new.start_date)::integer + 7) % 7);

    insert into public.sessions (cohort_id, week_number, title, starts_at, kind)
    select
      new.id,
      week_number,
      format('Week %s cohort session', week_number),
      ((first_session_date + ((week_number - 1) * 7) + new.session_time) at time zone new.timezone),
      'group'::public.session_kind
    from generate_series(1, 4) as week_number;
  end if;

  return new;
end;
$$;

create or replace function public.effective_cohort_status(target_cohort_id uuid)
returns public.cohort_status
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    c.status_override,
    case
      when (now() at time zone c.timezone)::date < c.start_date then 'upcoming'::public.cohort_status
      when c.workspace_type = 'cohort' and (now() at time zone c.timezone)::date >= c.start_date + 28 then 'ended'::public.cohort_status
      else 'active'::public.cohort_status
    end
  )
  from public.cohorts c
  where c.id = target_cohort_id;
$$;

create or replace function public.cohort_current_week(target_cohort_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (now() at time zone c.timezone)::date < c.start_date then 0
    when c.workspace_type = 'cohort' and (now() at time zone c.timezone)::date >= c.start_date + 28 then 5
    else least(4, (floor(((now() at time zone c.timezone)::date - c.start_date) / 7.0) + 1)::smallint)
  end
  from public.cohorts c
  where c.id = target_cohort_id;
$$;

create or replace function public.validate_individual_workspace_msp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.cohorts c
    where c.id = new.cohort_id
      and c.workspace_type = 'individual'
  ) and exists (
    select 1
    from public.msps m
    where m.cohort_id = new.cohort_id
      and m.id <> new.id
  ) then
    raise exception 'An individual workspace can contain only one MSP';
  end if;

  return new;
end;
$$;

create trigger msps_validate_individual_workspace
before insert or update of cohort_id on public.msps
for each row execute function public.validate_individual_workspace_msp();

create or replace function public.create_individual_workspace(
  target_msp_name text,
  target_website text,
  target_start_date date,
  target_timezone text,
  target_lead_id uuid
)
returns table (cohort_id uuid, msp_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_program_id uuid;
  created_cohort_id uuid;
  created_msp_id uuid;
  clean_name text := trim(target_msp_name);
begin
  if not public.is_lemhi_admin() then
    raise exception 'Only a Lemhi admin can create an individual workspace';
  end if;

  if length(clean_name) < 2 or length(clean_name) > 120 then
    raise exception 'Enter an MSP name between 2 and 120 characters';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names tz where tz.name = target_timezone
  ) then
    raise exception 'Choose a valid time zone';
  end if;

  if nullif(trim(target_website), '') is not null
    and target_website !~* '^https?://'
  then
    raise exception 'Website must use http:// or https://';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = target_lead_id and p.role = 'lemhi_admin' and p.active
  ) then
    raise exception 'Choose an active Lemhi lead';
  end if;

  select p.id into active_program_id
  from public.programs p
  where p.active
  order by p.created_at
  limit 1;

  if active_program_id is null then
    raise exception 'No active program template is available';
  end if;

  insert into public.cohorts (
    program_id,
    name,
    start_date,
    timezone,
    session_weekday,
    session_time,
    lead_id,
    workspace_type
  ) values (
    active_program_id,
    clean_name || ' — Individual',
    target_start_date,
    target_timezone,
    extract(dow from target_start_date)::smallint,
    '11:00',
    target_lead_id,
    'individual'
  )
  returning id into created_cohort_id;

  insert into public.msps (cohort_id, name, website)
  values (created_cohort_id, clean_name, nullif(trim(target_website), ''))
  returning id into created_msp_id;

  return query select created_cohort_id, created_msp_id;
end;
$$;

revoke all on function public.create_individual_workspace(text, text, date, text, uuid) from public;
revoke all on function public.create_individual_workspace(text, text, date, text, uuid) from anon;
grant execute on function public.create_individual_workspace(text, text, date, text, uuid) to authenticated;

create or replace view public.cohort_peers
with (security_barrier = true) as
select peer.id, peer.name, peer.website, peer.logo_path
from public.msps peer
join public.msps viewer on viewer.id = public.current_msp_id()
join public.cohorts cohort on cohort.id = viewer.cohort_id
where peer.cohort_id = viewer.cohort_id
  and cohort.workspace_type = 'cohort'
  and peer.status = 'active'
  and viewer.status = 'active'
  and peer.id <> viewer.id;
