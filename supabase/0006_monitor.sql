-- =====================================================================
-- 0006_monitor.sql — Phase 9: Monitor KPIs (a saved population filter +
-- a metric + a goal, graded ok/warn/alert). Run AFTER 0005. Same
-- access model: no RLS; anon/authenticated revoked, service_role only.
-- Idempotent.
-- =====================================================================

create table if not exists public.monitor_kpis (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ordinal         int  not null,
  name            text not null,
  filter          jsonb,                         -- Predicate IR | null (= all)
  metric          jsonb not null,                -- {kind:'count'} | {kind:'avg',item}
  goal            numeric not null,
  direction       text not null
                    check (direction in ('higher_better','lower_better')),
  warn_pct        numeric not null default 5,
  alert_pct       numeric not null default 15,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, name)
);
create index if not exists monitor_kpis_org_idx
  on public.monitor_kpis(organization_id, ordinal);

drop trigger if exists monitor_kpis_set_updated_at on public.monitor_kpis;
create trigger monitor_kpis_set_updated_at before update on public.monitor_kpis
  for each row execute function public.set_updated_at();

revoke all on public.monitor_kpis from anon, authenticated;
grant  all on public.monitor_kpis to service_role;
