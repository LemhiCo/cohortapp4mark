-- Give MSP contacts a full business day to complete account setup. Supabase
-- Auth's Email OTP Expiration must also be 86,400 seconds so both layers agree.
alter table public.invitations
  alter column expires_at set default (now() + interval '24 hours');
