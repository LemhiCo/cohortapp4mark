alter table public.invitations
  add column if not exists full_name text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invitations_full_name_length_check'
      and conrelid = 'public.invitations'::regclass
  ) then
    alter table public.invitations
      add constraint invitations_full_name_length_check
      check (length(full_name) <= 120);
  end if;
end
$$;
