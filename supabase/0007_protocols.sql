-- =====================================================================
-- 0007_protocols.sql — Phase 9b: sync/repro protocols (enrollment
-- predicate + anchor date item + ordered day-offset steps). Run AFTER
-- 0006. No RLS; anon/authenticated revoked, service_role only.
-- Idempotent.
-- =====================================================================

create table if not exists public.protocols (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ordinal         int  not null,
  name            text not null,
  enroll          jsonb not null,                -- Predicate IR (who's on it)
  anchor          text not null,                 -- derived date item (FDAT, DDAT…)
  steps           jsonb not null,                -- [{dayOffset,label,eventCode?}]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, name)
);
create index if not exists protocols_org_idx
  on public.protocols(organization_id, ordinal);

drop trigger if exists protocols_set_updated_at on public.protocols;
create trigger protocols_set_updated_at before update on public.protocols
  for each row execute function public.set_updated_at();

revoke all on public.protocols from anon, authenticated;
grant  all on public.protocols to service_role;
