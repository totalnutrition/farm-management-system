-- =====================================================================
-- 0004_grouping.sql — Phase 7: the grouping ruleset (ordered rules that
-- compute each animal's target pen). Run AFTER 0003. Same access model
-- as the rest: no RLS; revoked from anon/authenticated, granted only
-- to service_role. Idempotent.
-- =====================================================================

create table if not exists public.grouping_rules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ordinal         int  not null,                 -- evaluation order; first match wins
  name            text not null,
  predicate       jsonb not null,                -- the Query Predicate IR
  target_pen      text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, name)
);
create index if not exists grouping_rules_org_idx
  on public.grouping_rules(organization_id, ordinal);

drop trigger if exists grouping_rules_set_updated_at on public.grouping_rules;
create trigger grouping_rules_set_updated_at before update on public.grouping_rules
  for each row execute function public.set_updated_at();

revoke all on public.grouping_rules from anon, authenticated;
grant  all on public.grouping_rules to service_role;
