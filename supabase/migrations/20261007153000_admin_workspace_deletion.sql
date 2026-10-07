-- Keep a durable record of destructive admin actions even after the target
-- cohort or MSP portal is gone. Writes are service-role only; admins may read.
create table public.admin_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('cohort', 'msp')),
  target_id uuid not null,
  target_name text not null check (length(trim(target_name)) > 0),
  reason text not null check (length(trim(reason)) between 10 and 500),
  owner_email extensions.citext not null,
  deleted_by uuid references public.profiles (id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed')),
  failure_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index admin_deletion_audit_created_idx
  on public.admin_deletion_audit (created_at desc);

alter table public.admin_deletion_audit enable row level security;

create policy admin_deletion_audit_admin_read on public.admin_deletion_audit
for select to authenticated using (public.is_lemhi_admin());
