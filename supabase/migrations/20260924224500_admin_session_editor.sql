create or replace function public.update_group_session_local(
  target_session_id uuid,
  local_starts_at timestamp without time zone,
  target_title text,
  target_join_url text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cohort_timezone text;
begin
  if not public.is_lemhi_admin() then
    raise exception 'Only Lemhi admins can update cohort sessions';
  end if;

  if length(trim(target_title)) = 0 then
    raise exception 'A session title is required';
  end if;

  select c.timezone
  into cohort_timezone
  from public.sessions s
  join public.cohorts c on c.id = s.cohort_id
  where s.id = target_session_id
    and s.kind = 'group';

  if cohort_timezone is null then
    raise exception 'Group session not found';
  end if;

  update public.sessions
  set
    title = trim(target_title),
    starts_at = local_starts_at at time zone cohort_timezone,
    join_url = nullif(trim(target_join_url), '')
  where id = target_session_id;
end;
$$;

revoke all on function public.update_group_session_local(uuid, timestamp without time zone, text, text) from public;
grant execute on function public.update_group_session_local(uuid, timestamp without time zone, text, text) to authenticated;
