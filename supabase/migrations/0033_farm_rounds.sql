-- ===================================================================
-- 0033_farm_rounds.sql
-- Farm rounds — supervisors walk the barn, scan cows with RFID, log
-- heats / sickness / injuries / lameness on the spot. Each observation
-- writes into the appropriate specialised table (repro_events for
-- heat, health_events for everything else) tagged with the round it
-- came from, so the cow's timeline and the Hot list pick it up
-- without knowing about rounds.
-- ===================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'round_status') then
    create type round_status as enum ('active', 'completed', 'abandoned');
  end if;
end$$;

create table if not exists public.farm_rounds (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  -- Free-form supervisor identifier — we don't FK to workers yet
  -- because the worker may not be a system user.
  supervisor_name text,
  supervisor_user_id uuid references public.profiles(user_id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status round_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists farm_rounds_location_status_idx
  on public.farm_rounds (location_id, status, started_at desc);

alter table public.farm_rounds enable row level security;

drop policy if exists farm_rounds_select on public.farm_rounds;
create policy farm_rounds_select on public.farm_rounds for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists farm_rounds_write on public.farm_rounds;
create policy farm_rounds_write on public.farm_rounds for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- Tag specialised events with the round they came from. Nullable so
-- existing non-round events are unaffected; SET NULL on delete so
-- deleting a round doesn't lose the events.
do $$ begin
  alter table public.repro_events
    add column if not exists round_id uuid references public.farm_rounds(id) on delete set null;
exception when undefined_table then null; end $$;

do $$ begin
  alter table public.health_events
    add column if not exists round_id uuid references public.farm_rounds(id) on delete set null;
exception when undefined_table then null; end $$;

create index if not exists repro_events_round_idx on public.repro_events (round_id) where round_id is not null;
create index if not exists health_events_round_idx on public.health_events (round_id) where round_id is not null;

comment on table public.farm_rounds is
  'Supervisor walk-throughs. Observations made during a round are written into repro_events / health_events and tagged via round_id.';
