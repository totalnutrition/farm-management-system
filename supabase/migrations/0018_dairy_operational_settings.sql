-- =====================================================================
-- 0018 — Per-location dairy operational settings
-- =====================================================================
-- Mirrors the DC305 SETUP commands / Bovisync herd-setup tabs. One row
-- per location holds the scalar dairy operational config:
--   - Reproduction (VWP, heat detection, preg check schedule, KPIs)
--   - Transition (dry-off DCC, close-up DCC, calving alert)
--   - Milk quality thresholds (SCC, fat/protein targets)
--   - Withdrawal policy
--   - Bulk-tank reconciliation threshold
--   - Cull / RHA targets
--   - Animal numbering (tag prefix, RFID type, 840 requirement)
--
-- Sync protocols and per-event protocols (vaccination, hoof-trim,
-- treatment, milking shifts, feed-cost) get their own tables in later
-- migrations.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'heat_detection_method') then
    create type heat_detection_method as enum (
      'visual', 'activity_monitor', 'tail_paint', 'mounting',
      'pedometer', 'mixed'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'rfid_tag_type') then
    create type rfid_tag_type as enum ('hdx', 'fdx', 'none');
  end if;
end $$;

create table if not exists public.location_dairy_settings (
  location_id uuid primary key references public.locations(id) on delete cascade,

  -- Reproduction
  voluntary_waiting_period_days int not null default 50,
  heat_detection_method heat_detection_method not null default 'visual',
  preg_check_initial_days int not null default 28,
  preg_check_confirm_days int not null default 60,
  expected_gestation_days int not null default 280,
  preg_rate_target_pct numeric(5, 2),
  conception_rate_target_pct numeric(5, 2),
  services_per_conception_target numeric(4, 2),
  do_not_breed_days_threshold int,           -- DIM beyond which auto-DNB suggested

  -- Transition
  dry_off_dcc_days int not null default 220,
  close_up_dcc_days int not null default 250,
  calving_alert_days_before int not null default 14,

  -- Milk quality thresholds
  scc_hospital_threshold int not null default 400000,
  scc_linear_score_hospital numeric(4, 1) not null default 4.0,
  fat_target_pct numeric(5, 2),
  protein_target_pct numeric(5, 2),

  -- Withdrawal policy
  withdrawal_auto_flag boolean not null default true,
  withdrawal_extra_label_multiplier numeric(5, 2) not null default 1.00,
  withdrawal_lookback_days int not null default 30,

  -- Bulk tank
  bulk_tank_reconciliation_threshold_pct numeric(5, 2) not null default 5.00,
  bulk_tank_pickup_cadence text,             -- 'every-other-day' / 'daily' / 'weekly' / custom

  -- Cull / RHA targets
  cull_rate_target_pct numeric(5, 2),
  rha_milk_target_kg int,

  -- Animal numbering
  animal_id_prefix text,
  animal_id_padding int not null default 0,
  rfid_type rfid_tag_type not null default 'none',
  require_840_id boolean not null default false,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dairy_settings_vwp_range check (voluntary_waiting_period_days between 0 and 200),
  constraint dairy_settings_preg_initial_range check (preg_check_initial_days between 14 and 90),
  constraint dairy_settings_gestation_range check (expected_gestation_days between 250 and 310),
  constraint dairy_settings_dry_off_range check (dry_off_dcc_days between 150 and 300),
  constraint dairy_settings_close_up_range check (close_up_dcc_days between 200 and 290),
  constraint dairy_settings_recon_range check (bulk_tank_reconciliation_threshold_pct between 0 and 100)
);

drop trigger if exists location_dairy_settings_set_updated_at on public.location_dairy_settings;
create trigger location_dairy_settings_set_updated_at
  before update on public.location_dairy_settings
  for each row execute function public.set_updated_at();

alter table public.location_dairy_settings enable row level security;

drop policy if exists location_dairy_settings_select on public.location_dairy_settings;
create policy location_dairy_settings_select on public.location_dairy_settings for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists location_dairy_settings_write on public.location_dairy_settings;
create policy location_dairy_settings_write on public.location_dairy_settings for all
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
