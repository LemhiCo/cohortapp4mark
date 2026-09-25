-- Adds two fixed demo identities used only by the in-app "switch view" toggle
-- (components/app-shell.tsx -> app/actions.ts:switchDemoView). Neither email is
-- ever reachable by typing something on the public sign-in form: that form
-- always hashes whatever the visitor enters into the demo-[a-f0-9]{20}@lemhi.com
-- shape handled below, so it can never produce these two literal addresses.
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

  -- Fixed demo admin identity for the "view as admin" toggle. Grants
  -- lemhi_admin without an admin_allowlist row, but only for this one
  -- hardcoded address, which the app itself never derives from user input.
  if lower(new.email) = 'demo-admin@lemhi.com'
    and new.raw_user_meta_data ->> 'demo_access' = 'true' then
    insert into public.profiles (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', 'Lemhi Demo Admin'),
      'lemhi_admin'
    );
    return new;
  end if;

  -- Fixed demo client identity for the "view as client" side of the same
  -- toggle. Mirrors the shared demo MSP viewer below but at a stable address
  -- so switching back and forth doesn't depend on the visitor's original
  -- claimed email.
  if lower(new.email) = 'demo-client@lemhi.com'
    and new.raw_user_meta_data ->> 'demo_access' = 'true'
    and exists (
      select 1
      from public.msps m
      where m.id = '21000000-0000-4000-8000-000000000001'
        and m.status = 'active'
    ) then
    insert into public.profiles (id, email, full_name, role, msp_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', 'Lemhi Demo Viewer'),
      'msp_member',
      '21000000-0000-4000-8000-000000000001'
    );
    return new;
  end if;

  -- The application can generate a no-email session for one shared demo user.
  -- It is deliberately limited to the seeded fake MSP and never grants admin.
  if lower(new.email) ~ '^demo-[a-f0-9]{20}@lemhi[.]com$'
    and new.raw_user_meta_data ->> 'demo_access' = 'true'
    and exists (
      select 1
      from public.msps m
      where m.id = '21000000-0000-4000-8000-000000000001'
        and m.status = 'active'
    ) then
    insert into public.profiles (id, email, full_name, role, msp_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', 'Lemhi Demo Viewer'),
      'msp_member',
      '21000000-0000-4000-8000-000000000001'
    );
    return new;
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
