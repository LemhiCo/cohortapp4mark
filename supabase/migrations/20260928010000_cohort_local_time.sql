-- A cohort's week and status follow the calendar in its own time zone, not
-- the database's UTC date. With UTC, an Eastern cohort rolled into its next
-- week (and "behind" flags appeared) at 8 PM the evening before.

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
      when (now() at time zone c.timezone)::date >= c.start_date + 28 then 'ended'::public.cohort_status
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
    when (now() at time zone c.timezone)::date >= c.start_date + 28 then 5
    else (floor(((now() at time zone c.timezone)::date - c.start_date) / 7.0) + 1)::smallint
  end
  from public.cohorts c
  where c.id = target_cohort_id;
$$;
