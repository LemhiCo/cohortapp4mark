begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

-- Kiritimati (UTC+14) is always at least one calendar day ahead of Pago Pago
-- (UTC-11), so the same start date is "today" in one and still in the future
-- in the other. A UTC-based calculation gets one of the two wrong at any hour.
insert into public.cohorts (id, program_id, name, start_date, timezone, session_weekday, session_time)
values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Time zone ahead',
   (now() at time zone 'Pacific/Kiritimati')::date, 'Pacific/Kiritimati', 1, '11:00'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Time zone behind',
   (now() at time zone 'Pacific/Kiritimati')::date, 'Pacific/Pago_Pago', 1, '11:00'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Last local day',
   (now() at time zone 'America/New_York')::date - 27, 'America/New_York', 1, '11:00'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'First ended day',
   (now() at time zone 'America/New_York')::date - 28, 'America/New_York', 1, '11:00');

select is(
  public.cohort_current_week('40000000-0000-4000-8000-000000000001'), 1::smallint,
  'A cohort that starts today in its own time zone is in week 1'
);
select is(
  public.effective_cohort_status('40000000-0000-4000-8000-000000000001'), 'active'::public.cohort_status,
  'A cohort that starts today in its own time zone is active'
);
select is(
  public.cohort_current_week('40000000-0000-4000-8000-000000000002'), 0::smallint,
  'The same start date has not arrived yet in a time zone that is behind'
);
select is(
  public.effective_cohort_status('40000000-0000-4000-8000-000000000002'), 'upcoming'::public.cohort_status,
  'The same start date is still upcoming in a time zone that is behind'
);
select is(
  public.cohort_current_week('40000000-0000-4000-8000-000000000003'), 4::smallint,
  'The 28th local day is still week 4'
);
select is(
  public.effective_cohort_status('40000000-0000-4000-8000-000000000003'), 'active'::public.cohort_status,
  'The 28th local day is still active'
);
select is(
  public.cohort_current_week('40000000-0000-4000-8000-000000000004'), 5::smallint,
  'The day after four local weeks is past week 4'
);
select is(
  public.effective_cohort_status('40000000-0000-4000-8000-000000000004'), 'ended'::public.cohort_status,
  'The day after four local weeks is ended'
);

select * from finish();
rollback;
