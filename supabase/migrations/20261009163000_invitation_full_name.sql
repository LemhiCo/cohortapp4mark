alter table public.invitations
  add column full_name text not null default '';

alter table public.invitations
  add constraint invitations_full_name_length_check
  check (length(full_name) <= 120);
