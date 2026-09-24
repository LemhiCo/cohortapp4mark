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
