-- ===================================================================
-- 0034_location_playbook.sql
-- The Operations Playbook — one row per location capturing every
-- operational policy decision in one place. Replaces the fragmentation
-- where the same farm's choices were scattered across Settings →
-- Organization → Protocols, Settings → Location → Reproduction,
-- Settings → Location → Recording, etc.
--
-- Two columns categories:
--   1. Active protocol selections (FKs to org_*_protocols). NULL means
--      "no protocol chosen / fall back to org default seed".
--   2. KPI overrides — JSONB keyed by kpi_key. Resolution order at
--      read time: location override → org default → hardcoded fallback
--      in lib/playbook.ts.
--
-- The protocol catalogs themselves stay org-scoped (one library per
-- org, many locations adopt). This table is the per-location pointer.
-- ===================================================================

create table if not exists public.location_playbook (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null unique references public.locations(id) on delete cascade,
  -- Active protocol selections — nullable, one per kind.
  repro_protocol_id        uuid references public.org_repro_protocols(id)        on delete set null,
  vaccination_protocol_id  uuid references public.org_vaccination_protocols(id)  on delete set null,
  treatment_protocol_id    uuid references public.org_treatment_protocols(id)    on delete set null,
  hoof_trim_protocol_id    uuid references public.org_hoof_trim_protocols(id)    on delete set null,
  deworming_protocol_id    uuid references public.org_deworming_protocols(id)    on delete set null,
  dry_off_protocol_id      uuid references public.org_dry_off_protocols(id)      on delete set null,
  -- Per-location KPI threshold overrides. Keys are stable (see
  -- lib/playbook.ts → KPI_KEYS); values are numeric. Examples:
  --   { "lameness_locomotion_threshold": 3,
  --     "open_threshold_dim": 150,
  --     "test_day_stale_days": 30,
  --     "stocking_overstock_pct": 1.15,
  --     "due_to_calve_window_days": 14,
  --     "pr21_target_pct": 22,
  --     "scc_ceiling_thousands": 250 }
  kpi_overrides jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists location_playbook_location_idx
  on public.location_playbook (location_id);

drop trigger if exists location_playbook_set_updated_at on public.location_playbook;
create trigger location_playbook_set_updated_at
  before update on public.location_playbook
  for each row execute function public.set_updated_at();

alter table public.location_playbook enable row level security;

drop policy if exists location_playbook_select on public.location_playbook;
create policy location_playbook_select on public.location_playbook for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists location_playbook_write on public.location_playbook;
create policy location_playbook_write on public.location_playbook for all
  using (
    public.auth_role() = 'super_admin'
    or (
      public.auth_role() = 'admin'
      and exists (
        select 1 from public.locations l
        where l.id = location_id and l.organization_id = public.auth_org_id()
      )
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or (
      public.auth_role() = 'admin'
      and exists (
        select 1 from public.locations l
        where l.id = location_id and l.organization_id = public.auth_org_id()
      )
    )
  );

comment on table public.location_playbook is
  'Per-location active protocol selections + KPI threshold overrides. The single source of truth for "how this farm runs".';
