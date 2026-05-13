-- =====================================================================
-- 0007 — Recording profile per location
-- =====================================================================
-- docs/plan.md §6.1: captures how a farm records milk so downstream
-- modules know what UIs to surface (test-day only vs daily vs robotic),
-- what cardinality to expect from the milkings table, and how to
-- reconcile against bulk-tank readings.

-- ---------- Enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'test_day_frequency') then
    create type test_day_frequency as enum ('none', 'monthly', 'fortnightly', 'weekly');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'milkings_per_day') then
    create type milkings_per_day as enum ('1x', '2x', '3x', 'robotic');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'recording_method') then
    create type recording_method as enum (
      'parlor_meters_icar',
      'walk_thru_meters',
      'pail',
      'visual_estimate',
      'mobile_entry',
      'robotic'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bulk_tank_frequency') then
    create type bulk_tank_frequency as enum ('daily', 'per_pickup', 'none');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'component_sampling') then
    create type component_sampling as enum ('dhi_lab', 'inline_fat_protein', 'bulk_tank_only', 'none');
  end if;
end$$;

-- ---------- Table ----------
create table if not exists public.recording_profiles (
  location_id uuid primary key references public.locations(id) on delete cascade,
  test_day_frequency       test_day_frequency      not null default 'monthly',
  daily_recording_enabled  boolean                 not null default false,
  milkings_per_day         milkings_per_day        not null default '2x',
  recording_method         recording_method        not null default 'parlor_meters_icar',
  bulk_tank_recording      bulk_tank_frequency     not null default 'per_pickup',
  component_sampling       component_sampling      not null default 'dhi_lab',
  notes                    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists recording_profiles_set_updated_at on public.recording_profiles;
create trigger recording_profiles_set_updated_at
  before update on public.recording_profiles
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.recording_profiles enable row level security;

drop policy if exists recording_profiles_select on public.recording_profiles;
create policy recording_profiles_select on public.recording_profiles for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists recording_profiles_write on public.recording_profiles;
create policy recording_profiles_write on public.recording_profiles for all
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
