create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('lemhi_admin', 'msp_owner', 'msp_member');
create type public.owner_type as enum ('msp', 'lemhi');
create type public.task_kind as enum ('task', 'checkpoint');
create type public.cohort_status as enum ('upcoming', 'active', 'ended');
create type public.session_kind as enum ('group', 'one_on_one');
create type public.msp_status as enum ('active', 'deactivated');
create type public.asset_scope as enum ('program', 'cohort', 'msp');
create type public.asset_category as enum ('recording', 'transcript', 'documentation', 'marketing_asset', 'link');
create type public.asset_kind as enum ('file', 'link');
create type public.asset_status as enum ('pending', 'ready', 'failed');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table public.admin_allowlist (
  email extensions.citext primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index programs_one_active_idx on public.programs (active) where active;

create table public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  week_number smallint not null check (week_number between 1 and 4),
  title text not null check (length(trim(title)) > 0),
  subtitle text not null default '',
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, week_number),
  unique (id, program_id)
);

create table public.program_tasks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  week_id uuid not null,
  position smallint not null check (position > 0),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  owner_label text not null check (length(trim(owner_label)) > 0),
  owner_type public.owner_type not null,
  kind public.task_kind not null default 'task',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (week_id, program_id) references public.program_weeks (id, program_id) on delete restrict
);

create unique index program_tasks_active_position_idx
  on public.program_tasks (week_id, position)
  where archived_at is null;
create index program_tasks_program_idx on public.program_tasks (program_id);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  name text not null unique check (length(trim(name)) > 0),
  start_date date not null,
  timezone text not null default 'America/New_York',
  session_weekday smallint not null check (session_weekday between 0 and 6),
  session_time time not null,
  lead_id uuid,
  status_override public.cohort_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cohorts_program_idx on public.cohorts (program_id);
create index cohorts_start_date_idx on public.cohorts (start_date);

create table public.msps (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  website text,
  logo_path text,
  status public.msp_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, name),
  unique (id, cohort_id)
);

create index msps_cohort_idx on public.msps (cohort_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null unique,
  full_name text not null default '',
  role public.app_role not null,
  msp_id uuid references public.msps (id) on delete restrict,
  title text,
  photo_path text,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (role = 'lemhi_admin' and msp_id is null)
    or (role in ('msp_owner', 'msp_member') and msp_id is not null)
  )
);

create unique index profiles_one_active_owner_per_msp_idx
  on public.profiles (msp_id)
  where role = 'msp_owner' and active;
create index profiles_msp_idx on public.profiles (msp_id) where msp_id is not null;

alter table public.cohorts
  add constraint cohorts_lead_id_fkey foreign key (lead_id) references public.profiles (id) on delete set null;

create table public.cohort_weeks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  template_week_id uuid references public.program_weeks (id) on delete set null,
  week_number smallint not null check (week_number between 1 and 4),
  title text not null,
  subtitle text not null default '',
  goal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, week_number),
  unique (cohort_id, template_week_id),
  unique (id, cohort_id)
);

create index cohort_weeks_cohort_idx on public.cohort_weeks (cohort_id);

create table public.cohort_tasks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  cohort_week_id uuid not null,
  template_task_id uuid references public.program_tasks (id) on delete set null,
  msp_id uuid references public.msps (id) on delete cascade,
  position smallint not null check (position > 0),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  owner_label text not null check (length(trim(owner_label)) > 0),
  owner_type public.owner_type not null,
  kind public.task_kind not null default 'task',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (cohort_week_id, cohort_id) references public.cohort_weeks (id, cohort_id) on delete cascade,
  check (template_task_id is not null or msp_id is not null)
);

create unique index cohort_tasks_template_idx
  on public.cohort_tasks (cohort_id, template_task_id)
  where template_task_id is not null;
create unique index cohort_tasks_shared_position_idx
  on public.cohort_tasks (cohort_week_id, position)
  where msp_id is null and archived_at is null;
create unique index cohort_tasks_extra_position_idx
  on public.cohort_tasks (cohort_week_id, msp_id, position)
  where msp_id is not null and archived_at is null;
create index cohort_tasks_cohort_idx on public.cohort_tasks (cohort_id);
create index cohort_tasks_msp_idx on public.cohort_tasks (msp_id) where msp_id is not null;

create table public.msp_hidden_tasks (
  msp_id uuid not null references public.msps (id) on delete cascade,
  cohort_task_id uuid not null references public.cohort_tasks (id) on delete cascade,
  hidden_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (msp_id, cohort_task_id)
);

create index msp_hidden_tasks_task_idx on public.msp_hidden_tasks (cohort_task_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  msp_id uuid references public.msps (id) on delete cascade,
  week_number smallint check (week_number between 1 and 4),
  title text not null check (length(trim(title)) > 0),
  starts_at timestamptz not null,
  join_url text,
  kind public.session_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'group' and msp_id is null and week_number is not null)
    or (kind = 'one_on_one' and msp_id is not null and week_number is null)
  )
);

create unique index sessions_group_week_idx
  on public.sessions (cohort_id, week_number)
  where kind = 'group';
create index sessions_cohort_starts_idx on public.sessions (cohort_id, starts_at);
create index sessions_msp_starts_idx on public.sessions (msp_id, starts_at) where msp_id is not null;

create table public.task_completions (
  msp_id uuid not null references public.msps (id) on delete cascade,
  cohort_task_id uuid not null references public.cohort_tasks (id) on delete cascade,
  completed_by uuid not null references public.profiles (id) on delete restrict,
  completed_at timestamptz not null default now(),
  primary key (msp_id, cohort_task_id)
);

create index task_completions_task_idx on public.task_completions (cohort_task_id);
create index task_completions_completed_by_idx on public.task_completions (completed_by);

create table public.task_notes (
  id uuid primary key default gen_random_uuid(),
  msp_id uuid not null references public.msps (id) on delete cascade,
  cohort_task_id uuid not null references public.cohort_tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index task_notes_thread_idx on public.task_notes (msp_id, cohort_task_id, created_at);
create index task_notes_author_idx on public.task_notes (author_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category public.asset_category not null,
  kind public.asset_kind not null,
  status public.asset_status not null default 'pending',
  storage_path text unique,
  external_url text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  scope public.asset_scope not null,
  program_id uuid references public.programs (id) on delete restrict,
  cohort_id uuid references public.cohorts (id) on delete cascade,
  msp_id uuid references public.msps (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  program_week_id uuid references public.program_weeks (id) on delete set null,
  program_task_id uuid references public.program_tasks (id) on delete set null,
  cohort_week_id uuid references public.cohort_weeks (id) on delete set null,
  cohort_task_id uuid references public.cohort_tasks (id) on delete set null,
  summary text,
  action_items jsonb not null default '[]'::jsonb check (jsonb_typeof(action_items) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'file' and storage_path is not null and external_url is null)
    or (kind = 'link' and external_url is not null and storage_path is null)
  ),
  check (
    (scope = 'program' and program_id is not null and cohort_id is null and msp_id is null)
    or (scope = 'cohort' and program_id is null and cohort_id is not null and msp_id is null)
    or (scope = 'msp' and program_id is null and cohort_id is null and msp_id is not null)
  ),
  check (num_nonnulls(program_week_id, program_task_id, cohort_week_id, cohort_task_id) <= 1),
  check (
    (scope = 'program' and cohort_week_id is null and cohort_task_id is null)
    or (scope in ('cohort', 'msp') and program_week_id is null and program_task_id is null)
  )
);

create index assets_program_idx on public.assets (program_id, category) where scope = 'program';
create index assets_cohort_idx on public.assets (cohort_id, category) where scope = 'cohort';
create index assets_msp_idx on public.assets (msp_id, category) where scope = 'msp';
create index assets_session_idx on public.assets (session_id) where session_id is not null;
create index assets_ready_created_idx on public.assets (status, created_at desc);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  role public.app_role not null check (role in ('msp_owner', 'msp_member')),
  msp_id uuid not null references public.msps (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete restrict,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '1 hour'),
  accepted_at timestamptz,
  auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index invitations_one_open_email_idx
  on public.invitations (email)
  where status = 'pending';
create index invitations_msp_idx on public.invitations (msp_id, status);

create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  msp_id uuid references public.msps (id) on delete cascade,
  event_type text not null check (event_type in ('sign_in', 'view', 'asset_open')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index activity_events_user_created_idx on public.activity_events (user_id, created_at desc);
create index activity_events_msp_created_idx on public.activity_events (msp_id, created_at desc) where msp_id is not null;
create index activity_events_type_created_idx on public.activity_events (event_type, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger programs_set_updated_at before update on public.programs
for each row execute function public.set_updated_at();
create trigger program_weeks_set_updated_at before update on public.program_weeks
for each row execute function public.set_updated_at();
create trigger program_tasks_set_updated_at before update on public.program_tasks
for each row execute function public.set_updated_at();
create trigger cohorts_set_updated_at before update on public.cohorts
for each row execute function public.set_updated_at();
create trigger msps_set_updated_at before update on public.msps
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger cohort_weeks_set_updated_at before update on public.cohort_weeks
for each row execute function public.set_updated_at();
create trigger cohort_tasks_set_updated_at before update on public.cohort_tasks
for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets
for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
for each row execute function public.set_updated_at();

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.msps m on m.id = p.msp_id
    where p.id = auth.uid()
      and p.active
      and (p.role = 'lemhi_admin' or m.status = 'active')
  );
$$;

create or replace function public.is_lemhi_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'lemhi_admin' and p.active
  );
$$;

create or replace function public.current_msp_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.msp_id
  from public.profiles p
  join public.msps m on m.id = p.msp_id
  where p.id = auth.uid() and p.active and m.status = 'active';
$$;

create or replace function public.current_cohort_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.cohort_id
  from public.profiles p
  join public.msps m on m.id = p.msp_id
  where p.id = auth.uid() and p.active and m.status = 'active';
$$;

create or replace function public.effective_cohort_status(target_cohort_id uuid)
returns public.cohort_status
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    c.status_override,
    case
      when current_date < c.start_date then 'upcoming'::public.cohort_status
      when current_date >= c.start_date + 28 then 'ended'::public.cohort_status
      else 'active'::public.cohort_status
    end
  )
  from public.cohorts c
  where c.id = target_cohort_id;
$$;

create or replace function public.cohort_is_writable(target_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.effective_cohort_status(target_cohort_id) <> 'ended';
$$;

create or replace function public.cohort_current_week(target_cohort_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when current_date < c.start_date then 0
    when current_date >= c.start_date + 28 then 5
    else (floor((current_date - c.start_date) / 7.0) + 1)::smallint
  end
  from public.cohorts c
  where c.id = target_cohort_id;
$$;

create or replace function public.validate_cohort_task_msp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.msp_id is not null and not exists (
    select 1 from public.msps m where m.id = new.msp_id and m.cohort_id = new.cohort_id
  ) then
    raise exception 'Extra task MSP must belong to the task cohort';
  end if;
  return new;
end;
$$;

create trigger cohort_tasks_validate_msp
before insert or update of msp_id, cohort_id on public.cohort_tasks
for each row execute function public.validate_cohort_task_msp();

create or replace function public.validate_hidden_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.msps m
    join public.cohort_tasks t on t.id = new.cohort_task_id
    where m.id = new.msp_id
      and m.cohort_id = t.cohort_id
      and t.msp_id is null
      and t.archived_at is null
  ) then
    raise exception 'Only an active shared task in the MSP cohort can be hidden';
  end if;
  return new;
end;
$$;

create trigger msp_hidden_tasks_validate
before insert or update on public.msp_hidden_tasks
for each row execute function public.validate_hidden_task();

create or replace function public.validate_task_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.msps m
    join public.cohort_tasks t on t.id = new.cohort_task_id
    where m.id = new.msp_id
      and m.cohort_id = t.cohort_id
      and (t.msp_id is null or t.msp_id = m.id)
      and t.archived_at is null
      and not exists (
        select 1 from public.msp_hidden_tasks h
        where h.msp_id = m.id and h.cohort_task_id = t.id
      )
  ) then
    raise exception 'Task is not available to this MSP';
  end if;
  return new;
end;
$$;

create trigger task_completions_validate
before insert or update on public.task_completions
for each row execute function public.validate_task_completion();

create or replace function public.validate_task_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.msps m
    join public.cohort_tasks t on t.id = new.cohort_task_id
    where m.id = new.msp_id
      and m.cohort_id = t.cohort_id
      and (t.msp_id is null or t.msp_id = m.id)
      and t.archived_at is null
      and not exists (
        select 1 from public.msp_hidden_tasks h
        where h.msp_id = m.id and h.cohort_task_id = t.id
      )
  ) then
    raise exception 'Task is not available to this MSP';
  end if;
  return new;
end;
$$;

create trigger task_notes_validate
before insert or update on public.task_notes
for each row execute function public.validate_task_note();

create or replace function public.validate_asset_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_cohort_id uuid;
begin
  if new.scope = 'cohort' then
    expected_cohort_id := new.cohort_id;
  elsif new.scope = 'msp' then
    select m.cohort_id into expected_cohort_id from public.msps m where m.id = new.msp_id;
  end if;

  if new.session_id is not null and not exists (
    select 1 from public.sessions s
    where s.id = new.session_id
      and (
        (new.scope = 'cohort' and s.kind = 'group' and s.cohort_id = expected_cohort_id)
        or (new.scope = 'msp' and s.kind = 'one_on_one' and s.msp_id = new.msp_id)
      )
  ) then
    raise exception 'Session does not match asset scope';
  end if;

  if new.cohort_week_id is not null and not exists (
    select 1 from public.cohort_weeks w where w.id = new.cohort_week_id and w.cohort_id = expected_cohort_id
  ) then
    raise exception 'Week does not match asset scope';
  end if;

  if new.cohort_task_id is not null and not exists (
    select 1 from public.cohort_tasks t
    where t.id = new.cohort_task_id
      and t.cohort_id = expected_cohort_id
      and (new.scope <> 'msp' or t.msp_id is null or t.msp_id = new.msp_id)
  ) then
    raise exception 'Task does not match asset scope';
  end if;

  if new.program_week_id is not null and not exists (
    select 1 from public.program_weeks w where w.id = new.program_week_id and w.program_id = new.program_id
  ) then
    raise exception 'Week does not match program asset scope';
  end if;

  if new.program_task_id is not null and not exists (
    select 1 from public.program_tasks t where t.id = new.program_task_id and t.program_id = new.program_id
  ) then
    raise exception 'Task does not match program asset scope';
  end if;

  return new;
end;
$$;

create trigger assets_validate_scope
before insert or update on public.assets
for each row execute function public.validate_asset_scope();

create or replace function public.bootstrap_cohort()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  first_session_date date;
begin
  insert into public.cohort_weeks (
    cohort_id, template_week_id, week_number, title, subtitle, goal
  )
  select new.id, w.id, w.week_number, w.title, w.subtitle, w.goal
  from public.program_weeks w
  where w.program_id = new.program_id
  order by w.week_number;

  insert into public.cohort_tasks (
    cohort_id, cohort_week_id, template_task_id, position, title, description,
    owner_label, owner_type, kind, archived_at
  )
  select
    new.id, cw.id, t.id, t.position, t.title, t.description,
    t.owner_label, t.owner_type, t.kind, t.archived_at
  from public.program_tasks t
  join public.program_weeks pw on pw.id = t.week_id
  join public.cohort_weeks cw
    on cw.cohort_id = new.id and cw.template_week_id = pw.id
  where t.program_id = new.program_id
  order by pw.week_number, t.position;

  first_session_date := new.start_date + ((new.session_weekday - extract(dow from new.start_date)::integer + 7) % 7);

  insert into public.sessions (cohort_id, week_number, title, starts_at, kind)
  select
    new.id,
    week_number,
    format('Week %s cohort session', week_number),
    ((first_session_date + ((week_number - 1) * 7) + new.session_time) at time zone new.timezone),
    'group'::public.session_kind
  from generate_series(1, 4) as week_number;

  return new;
end;
$$;

create trigger cohorts_bootstrap
after insert on public.cohorts
for each row execute function public.bootstrap_cohort();

create or replace function public.propagate_program_week()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.cohort_weeks cw
  set
    week_number = new.week_number,
    title = new.title,
    subtitle = new.subtitle,
    goal = new.goal
  from public.cohorts c
  where cw.template_week_id = new.id
    and c.id = cw.cohort_id
    and public.effective_cohort_status(c.id) <> 'ended';
  return new;
end;
$$;

create trigger program_weeks_propagate
after update of week_number, title, subtitle, goal on public.program_weeks
for each row execute function public.propagate_program_week();

create or replace function public.propagate_program_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cohort_tasks (
      cohort_id, cohort_week_id, template_task_id, position, title, description,
      owner_label, owner_type, kind, archived_at
    )
    select
      cw.cohort_id, cw.id, new.id, new.position, new.title, new.description,
      new.owner_label, new.owner_type, new.kind, new.archived_at
    from public.cohort_weeks cw
    join public.cohorts c on c.id = cw.cohort_id
    where cw.template_week_id = new.week_id
      and public.effective_cohort_status(c.id) <> 'ended';
  else
    update public.cohort_tasks ct
    set
      cohort_week_id = cw.id,
      position = new.position,
      title = new.title,
      description = new.description,
      owner_label = new.owner_label,
      owner_type = new.owner_type,
      kind = new.kind,
      archived_at = new.archived_at
    from public.cohorts c, public.cohort_weeks cw
    where ct.template_task_id = new.id
      and c.id = ct.cohort_id
      and cw.cohort_id = ct.cohort_id
      and cw.template_week_id = new.week_id
      and public.effective_cohort_status(c.id) <> 'ended';
  end if;
  return new;
end;
$$;

create trigger program_tasks_propagate_insert
after insert on public.program_tasks
for each row execute function public.propagate_program_task();
create trigger program_tasks_propagate_update
after update of week_id, position, title, description, owner_label, owner_type, kind, archived_at on public.program_tasks
for each row execute function public.propagate_program_task();

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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.can_access_asset(target_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_lemhi_admin() or exists (
    select 1
    from public.assets a
    join public.profiles p on p.id = auth.uid() and p.active
    join public.msps m on m.id = p.msp_id and m.status = 'active'
    where a.id = target_asset_id
      and a.status = 'ready'
      and (
        a.scope = 'program'
        or (a.scope = 'cohort' and a.cohort_id = m.cohort_id)
        or (a.scope = 'msp' and a.msp_id = m.id)
      )
  );
$$;

create or replace function public.can_access_asset_path(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.assets a
    where a.storage_path = target_path and public.can_access_asset(a.id)
  );
$$;

create or replace function public.can_access_logo_path(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_lemhi_admin() or exists (
    select 1
    from public.msps logo_msp
    join public.msps viewer_msp on viewer_msp.id = public.current_msp_id()
    where logo_msp.logo_path = target_path
      and logo_msp.status = 'active'
      and viewer_msp.status = 'active'
      and logo_msp.cohort_id = viewer_msp.cohort_id
  );
$$;

create view public.cohort_peers
with (security_barrier = true) as
select peer.id, peer.name, peer.website, peer.logo_path
from public.msps peer
join public.msps viewer on viewer.id = public.current_msp_id()
where peer.cohort_id = viewer.cohort_id
  and peer.status = 'active'
  and viewer.status = 'active'
  and peer.id <> viewer.id;

create view public.msp_progress
with (security_invoker = true) as
with visible_msps as (
  select m.id as msp_id, m.cohort_id
  from public.msps m
  where m.status = 'active'
),
eligible_tasks as (
  select
    m.msp_id,
    m.cohort_id,
    cw.week_number,
    ct.id as cohort_task_id,
    tc.completed_at
  from visible_msps m
  join public.cohort_tasks ct
    on ct.cohort_id = m.cohort_id
    and (ct.msp_id is null or ct.msp_id = m.msp_id)
    and ct.archived_at is null
  join public.cohort_weeks cw on cw.id = ct.cohort_week_id
  left join public.msp_hidden_tasks hidden
    on hidden.msp_id = m.msp_id and hidden.cohort_task_id = ct.id
  left join public.task_completions tc
    on tc.msp_id = m.msp_id and tc.cohort_task_id = ct.id
  where hidden.cohort_task_id is null
),
week_rollup as (
  select
    m.msp_id,
    m.cohort_id,
    cw.week_number,
    count(e.cohort_task_id)::integer as total_tasks,
    count(e.completed_at)::integer as completed_tasks
  from visible_msps m
  join public.cohort_weeks cw on cw.cohort_id = m.cohort_id
  left join eligible_tasks e
    on e.msp_id = m.msp_id and e.week_number = cw.week_number
  group by m.msp_id, m.cohort_id, cw.week_number
),
overall as (
  select
    m.msp_id,
    m.cohort_id,
    count(e.cohort_task_id)::integer as total_tasks,
    count(e.completed_at)::integer as completed_tasks,
    coalesce(bool_or(
      e.completed_at is null
      and e.week_number < public.cohort_current_week(m.cohort_id)
    ), false) as is_behind
  from visible_msps m
  left join eligible_tasks e on e.msp_id = m.msp_id
  group by m.msp_id, m.cohort_id
)
select
  w.msp_id,
  w.cohort_id,
  w.week_number,
  public.cohort_current_week(w.cohort_id) as current_week,
  w.total_tasks as week_total_tasks,
  w.completed_tasks as week_completed_tasks,
  case when w.total_tasks = 0 then 100
    else round((w.completed_tasks::numeric / w.total_tasks) * 100)::integer
  end as week_percent,
  o.total_tasks as overall_total_tasks,
  o.completed_tasks as overall_completed_tasks,
  case when o.total_tasks = 0 then 100
    else round((o.completed_tasks::numeric / o.total_tasks) * 100)::integer
  end as overall_percent,
  o.is_behind,
  (o.total_tasks > 0 and o.completed_tasks = o.total_tasks) as is_finished
from week_rollup w
join overall o on o.msp_id = w.msp_id
order by w.msp_id, w.week_number;

alter table public.admin_allowlist enable row level security;
alter table public.programs enable row level security;
alter table public.program_weeks enable row level security;
alter table public.program_tasks enable row level security;
alter table public.cohorts enable row level security;
alter table public.msps enable row level security;
alter table public.profiles enable row level security;
alter table public.cohort_weeks enable row level security;
alter table public.cohort_tasks enable row level security;
alter table public.msp_hidden_tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.task_completions enable row level security;
alter table public.task_notes enable row level security;
alter table public.assets enable row level security;
alter table public.invitations enable row level security;
alter table public.activity_events enable row level security;

create policy admin_allowlist_admin_all on public.admin_allowlist
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy programs_read on public.programs
for select to authenticated using (public.is_lemhi_admin() or (public.is_active_user() and active));
create policy programs_admin_all on public.programs
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy program_weeks_read on public.program_weeks
for select to authenticated using (public.is_active_user());
create policy program_weeks_admin_all on public.program_weeks
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy program_tasks_read on public.program_tasks
for select to authenticated using (public.is_active_user() and (public.is_lemhi_admin() or archived_at is null));
create policy program_tasks_admin_all on public.program_tasks
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy cohorts_read on public.cohorts
for select to authenticated using (public.is_lemhi_admin() or id = public.current_cohort_id());
create policy cohorts_admin_all on public.cohorts
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy msps_read_own on public.msps
for select to authenticated using (public.is_lemhi_admin() or id = public.current_msp_id());
create policy msps_admin_all on public.msps
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy profiles_read_team on public.profiles
for select to authenticated using (
  public.is_lemhi_admin()
  or id = auth.uid()
  or (msp_id is not null and msp_id = public.current_msp_id())
);
create policy profiles_admin_all on public.profiles
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy cohort_weeks_read on public.cohort_weeks
for select to authenticated using (public.is_lemhi_admin() or cohort_id = public.current_cohort_id());
create policy cohort_weeks_admin_all on public.cohort_weeks
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy cohort_tasks_read on public.cohort_tasks
for select to authenticated using (
  public.is_lemhi_admin()
  or (
    cohort_id = public.current_cohort_id()
    and archived_at is null
    and (msp_id is null or msp_id = public.current_msp_id())
    and not exists (
      select 1 from public.msp_hidden_tasks h
      where h.msp_id = public.current_msp_id() and h.cohort_task_id = id
    )
  )
);
create policy cohort_tasks_admin_all on public.cohort_tasks
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy hidden_tasks_read on public.msp_hidden_tasks
for select to authenticated using (public.is_lemhi_admin() or msp_id = public.current_msp_id());
create policy hidden_tasks_admin_all on public.msp_hidden_tasks
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy sessions_read on public.sessions
for select to authenticated using (
  public.is_lemhi_admin()
  or (
    cohort_id = public.current_cohort_id()
    and (kind = 'group' or msp_id = public.current_msp_id())
  )
);
create policy sessions_admin_all on public.sessions
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy task_completions_read on public.task_completions
for select to authenticated using (public.is_lemhi_admin() or msp_id = public.current_msp_id());
create policy task_completions_admin_all on public.task_completions
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());
create policy task_completions_msp_insert on public.task_completions
for insert to authenticated with check (
  msp_id = public.current_msp_id()
  and completed_by = auth.uid()
  and exists (
    select 1 from public.cohort_tasks t
    where t.id = cohort_task_id
      and t.cohort_id = public.current_cohort_id()
      and (t.msp_id is null or t.msp_id = public.current_msp_id())
      and t.owner_type = 'msp'
      and t.kind = 'task'
      and t.archived_at is null
      and public.cohort_is_writable(t.cohort_id)
  )
);
create policy task_completions_msp_update on public.task_completions
for update to authenticated using (
  msp_id = public.current_msp_id()
  and completed_by = auth.uid()
) with check (
  msp_id = public.current_msp_id()
  and completed_by = auth.uid()
  and exists (
    select 1 from public.cohort_tasks t
    where t.id = cohort_task_id
      and t.owner_type = 'msp'
      and t.kind = 'task'
      and public.cohort_is_writable(t.cohort_id)
  )
);
create policy task_completions_msp_delete on public.task_completions
for delete to authenticated using (
  msp_id = public.current_msp_id()
  and exists (
    select 1 from public.cohort_tasks t
    where t.id = cohort_task_id
      and t.owner_type = 'msp'
      and t.kind = 'task'
      and public.cohort_is_writable(t.cohort_id)
  )
);

create policy task_notes_read on public.task_notes
for select to authenticated using (public.is_lemhi_admin() or msp_id = public.current_msp_id());
create policy task_notes_admin_all on public.task_notes
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());
create policy task_notes_msp_insert on public.task_notes
for insert to authenticated with check (
  msp_id = public.current_msp_id()
  and author_id = auth.uid()
  and exists (
    select 1 from public.cohort_tasks t
    where t.id = cohort_task_id
      and t.cohort_id = public.current_cohort_id()
      and (t.msp_id is null or t.msp_id = public.current_msp_id())
      and t.archived_at is null
      and public.cohort_is_writable(t.cohort_id)
  )
);

create policy assets_read on public.assets
for select to authenticated using (public.can_access_asset(id));
create policy assets_admin_all on public.assets
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());

create policy invitations_read on public.invitations
for select to authenticated using (
  public.is_lemhi_admin()
  or (
    msp_id = public.current_msp_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'msp_owner' and p.active
    )
  )
);
create policy invitations_admin_all on public.invitations
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());
create policy invitations_owner_insert on public.invitations
for insert to authenticated with check (
  msp_id = public.current_msp_id()
  and role = 'msp_member'
  and invited_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.msps m on m.id = p.msp_id
    where p.id = auth.uid()
      and p.role = 'msp_owner'
      and p.active
      and m.status = 'active'
      and public.cohort_is_writable(m.cohort_id)
  )
);

create policy activity_events_admin_read on public.activity_events
for select to authenticated using (public.is_lemhi_admin());
create policy activity_events_admin_all on public.activity_events
for all to authenticated using (public.is_lemhi_admin()) with check (public.is_lemhi_admin());
create policy activity_events_self_insert on public.activity_events
for insert to authenticated with check (
  user_id = auth.uid()
  and (msp_id is null or msp_id = public.current_msp_id())
);

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on public.cohort_peers, public.msp_progress to authenticated;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.bootstrap_cohort() from public, anon, authenticated;
revoke all on function public.propagate_program_week() from public, anon, authenticated;
revoke all on function public.propagate_program_task() from public, anon, authenticated;
revoke all on function public.validate_cohort_task_msp() from public, anon, authenticated;
revoke all on function public.validate_hidden_task() from public, anon, authenticated;
revoke all on function public.validate_task_completion() from public, anon, authenticated;
revoke all on function public.validate_task_note() from public, anon, authenticated;
revoke all on function public.validate_asset_scope() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('portal-assets', 'portal-assets', false, 5368709120)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'msp-logos',
  'msp-logos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy portal_assets_read on storage.objects
for select to authenticated using (
  bucket_id = 'portal-assets' and public.can_access_asset_path(name)
);
create policy portal_assets_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'portal-assets' and public.is_lemhi_admin()
);
create policy portal_assets_admin_update on storage.objects
for update to authenticated using (
  bucket_id = 'portal-assets' and public.is_lemhi_admin()
) with check (
  bucket_id = 'portal-assets' and public.is_lemhi_admin()
);
create policy portal_assets_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'portal-assets' and public.is_lemhi_admin()
);

create policy msp_logos_read on storage.objects
for select to authenticated using (
  bucket_id = 'msp-logos' and public.can_access_logo_path(name)
);
create policy msp_logos_admin_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'msp-logos' and public.is_lemhi_admin()
);
create policy msp_logos_admin_update on storage.objects
for update to authenticated using (
  bucket_id = 'msp-logos' and public.is_lemhi_admin()
) with check (
  bucket_id = 'msp-logos' and public.is_lemhi_admin()
);
create policy msp_logos_admin_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'msp-logos' and public.is_lemhi_admin()
);
