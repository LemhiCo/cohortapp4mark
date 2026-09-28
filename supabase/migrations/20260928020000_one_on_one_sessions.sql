-- Creates a 1:1 session for one MSP so its recording, transcript and summary
-- can be uploaded as an MSP-scoped session package. The call time is entered
-- in the MSP's cohort time zone, like the group session editor.
create or replace function public.create_one_on_one_session(
  target_msp_id uuid,
  local_starts_at timestamp without time zone,
  target_title text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_cohort_id uuid;
  cohort_timezone text;
  new_session_id uuid;
begin
  if not public.is_lemhi_admin() then
    raise exception 'Only Lemhi admins can create 1:1 sessions';
  end if;

  if length(trim(coalesce(target_title, ''))) = 0 then
    raise exception 'A session title is required';
  end if;

  select m.cohort_id, c.timezone
  into target_cohort_id, cohort_timezone
  from public.msps m
  join public.cohorts c on c.id = m.cohort_id
  where m.id = target_msp_id;

  if target_cohort_id is null then
    raise exception 'MSP not found';
  end if;

  insert into public.sessions (cohort_id, msp_id, week_number, title, starts_at, kind)
  values (
    target_cohort_id,
    target_msp_id,
    null,
    trim(target_title),
    local_starts_at at time zone cohort_timezone,
    'one_on_one'
  )
  returning id into new_session_id;

  return new_session_id;
end;
$$;

revoke all on function public.create_one_on_one_session(uuid, timestamp without time zone, text) from public;
grant execute on function public.create_one_on_one_session(uuid, timestamp without time zone, text) to authenticated;
