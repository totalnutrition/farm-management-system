-- =====================================================================
-- 0008 — Herd profile + per-location groups
-- =====================================================================
-- docs/plan.md §3:
--   - herd_profile captures target counts + percentiles so the app can
--     auto-suggest a group strategy preset and compute the capacity plan.
--   - location_groups holds the actual instantiated groups for a farm.
--     Seeded by copying rows from org_group_strategy_preset_groups when
--     the user picks a preset.

-- ---------- herd_profile (per location) ----------
create table if not exists public.herd_profile (
  location_id uuid primary key references public.locations(id) on delete cascade,
  target_lactating_count int not null default 0,
  target_dry_count int not null default 0,
  target_heifer_count int not null default 0,
  target_calf_count int not null default 0,
  pct_primiparous numeric(5, 1) not null default 35.0,
  calving_interval_days int not null default 395,
  replacement_rate_pct numeric(5, 1) not null default 35.0,
  target_rolling_herd_avg_kg_yr int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint herd_profile_pct_primip_range check (pct_primiparous >= 0 and pct_primiparous <= 100),
  constraint herd_profile_calving_interval_range check (calving_interval_days >= 250 and calving_interval_days <= 700),
  constraint herd_profile_replacement_range check (replacement_rate_pct >= 0 and replacement_rate_pct <= 100),
  constraint herd_profile_counts_nonneg check (
    target_lactating_count >= 0 and target_dry_count >= 0
    and target_heifer_count >= 0 and target_calf_count >= 0
  )
);

drop trigger if exists herd_profile_set_updated_at on public.herd_profile;
create trigger herd_profile_set_updated_at
  before update on public.herd_profile
  for each row execute function public.set_updated_at();

alter table public.herd_profile enable row level security;

drop policy if exists herd_profile_select on public.herd_profile;
create policy herd_profile_select on public.herd_profile for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists herd_profile_write on public.herd_profile;
create policy herd_profile_write on public.herd_profile for all
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

-- ---------- location_groups (per location, seeded from preset) ----------
create table if not exists public.location_groups (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  preset_slug text,                       -- which strategy preset spawned this group
  group_slug text not null,
  label text not null,
  group_class text not null,              -- lactating / dry / transition / special / heifer / calf
  display_order int not null default 0,
  rule_predicates jsonb not null default '{}'::jsonb,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, group_slug)
);

create index if not exists location_groups_location_idx
  on public.location_groups(location_id);

drop trigger if exists location_groups_set_updated_at on public.location_groups;
create trigger location_groups_set_updated_at
  before update on public.location_groups
  for each row execute function public.set_updated_at();

alter table public.location_groups enable row level security;

drop policy if exists location_groups_select on public.location_groups;
create policy location_groups_select on public.location_groups for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists location_groups_write on public.location_groups;
create policy location_groups_write on public.location_groups for all
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
