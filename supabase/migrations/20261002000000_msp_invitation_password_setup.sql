-- Separate workspace setup from account access. Admins can save the main
-- contact on an MSP, review the whole cohort, and send setup links later.

alter table public.msps
  add column primary_contact_name text,
  add column primary_contact_email extensions.citext;

update public.msps m
set primary_contact_name = coalesce(
      nullif(trim(owner.full_name), ''),
      split_part(owner.email::text, '@', 1)
    ),
    primary_contact_email = owner.email
from (
  select distinct on (p.msp_id)
    p.msp_id,
    p.email,
    p.full_name
  from public.profiles p
  where p.role = 'msp_owner'
    and p.msp_id is not null
  order by p.msp_id, p.active desc, p.created_at desc
) owner
where owner.msp_id = m.id;

update public.msps m
set primary_contact_name = coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(invite.email::text, '@', 1)
    ),
    primary_contact_email = invite.email
from (
  select distinct on (i.msp_id)
    i.msp_id,
    i.email,
    i.auth_user_id
  from public.invitations i
  where i.role = 'msp_owner'
  order by i.msp_id, i.created_at desc
) invite
left join auth.users u on u.id = invite.auth_user_id
where invite.msp_id = m.id
  and m.primary_contact_email is null;

alter table public.msps
  add constraint msps_primary_contact_pair_check check (
    (primary_contact_name is null and primary_contact_email is null)
    or (
      primary_contact_name is not null
      and length(trim(primary_contact_name)) between 2 and 120
      and primary_contact_email is not null
    )
  );

create unique index msps_primary_contact_email_unique_idx
  on public.msps (primary_contact_email)
  where primary_contact_email is not null;

alter table public.profiles
  add column password_setup_required boolean not null default false;

alter table public.invitations
  add column last_sent_at timestamptz not null default now();

-- Every invited account must choose a password before portal routes or files
-- become available. Allow-listed Lemhi admins retain their existing login.
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
    insert into public.profiles (id, email, full_name, role, password_setup_required)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'lemhi_admin',
      false
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

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    msp_id,
    password_setup_required
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    invited.role,
    invited.msp_id,
    coalesce(new.encrypted_password, '') = ''
  );

  update public.invitations
  set auth_user_id = new.id
  where id = invited.id;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
