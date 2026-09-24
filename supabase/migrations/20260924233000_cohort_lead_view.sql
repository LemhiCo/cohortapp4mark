create view public.cohort_leads
with (security_barrier = true) as
select
  c.id as cohort_id,
  p.id,
  p.full_name,
  p.email,
  p.title,
  p.photo_path
from public.cohorts c
join public.profiles p on p.id = c.lead_id
where c.id = public.current_cohort_id()
  and p.role = 'lemhi_admin'
  and p.active;

revoke all on public.cohort_leads from anon;
grant select on public.cohort_leads to authenticated;
