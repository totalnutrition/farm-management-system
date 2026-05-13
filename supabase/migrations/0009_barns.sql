-- =====================================================================
-- 0009 — Barns (physical shells)
-- =====================================================================
-- docs/plan.md §4.2: Dairyland Initiative / UMN / Cornell field set.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'barn_type') then
    create type barn_type as enum (
      'freestall', 'tie_stall', 'bedded_pack', 'compost',
      'drylot', 'robotic', 'parlor', 'calf',
      'maternity_transition', 'hospital', 'heifer', 'hutches'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'row_configuration') then
    create type row_configuration as enum ('2_row', '3_row', '4_row', '6_row', 'other');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ventilation_type') then
    create type ventilation_type as enum ('natural', 'tunnel', 'cross', 'hybrid');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parlor_type') then
    create type parlor_type as enum ('parallel', 'herringbone', 'rotary', 'robot', 'swing', 'none');
  end if;
end$$;

create table if not exists public.barns (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  barn_code text,
  type barn_type not null,
  row_configuration row_configuration,
  -- Counts
  freestall_count int,
  headlock_count int,
  loafing_area_sqft int,
  holding_pen_capacity int,
  -- Stalls
  stall_surface text,           -- sand / mattress / waterbed / pack
  bedding_type text,
  stall_length_ft numeric(4, 1),
  stall_width_in numeric(4, 1),
  neck_rail_height_in numeric(4, 1),
  -- Bunk
  bunk_type text,               -- drive_through / feed_alley / fenceline
  bunk_total_linear_ft numeric(6, 1),
  -- Floor / manure
  floor_type text,              -- grooved_concrete / rubber / sand_laneway
  manure_handling text,         -- scrape / flush / vacuum / robot
  -- Ventilation
  ventilation_type ventilation_type,
  fan_count int,
  fan_diameter_in numeric(4, 1),
  soaker_lines_present boolean not null default false,
  soaker_nozzle_height_in numeric(4, 1),
  -- Cow comfort
  sprinklers boolean not null default false,
  fans_over_stalls boolean not null default false,
  brushes_count int,
  footbath_present boolean not null default false,
  -- Parlor barns only
  parlor_type parlor_type,
  parlor_stalls int,
  robot_count int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists barns_location_idx on public.barns(location_id);

drop trigger if exists barns_set_updated_at on public.barns;
create trigger barns_set_updated_at
  before update on public.barns
  for each row execute function public.set_updated_at();

alter table public.barns enable row level security;

drop policy if exists barns_select on public.barns;
create policy barns_select on public.barns for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists barns_write on public.barns;
create policy barns_write on public.barns for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  );
