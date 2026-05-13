-- =====================================================================
-- 0006 — ORG defaults + LOC overrides + inheritance resolver
-- =====================================================================
-- Implements docs/plan.md §2 three-level settings model: every
-- inheritable setting has ORG default and LOC override. NULL on LOC
-- means "inherit from ORG."

-- ---------- Add ORG defaults to organizations ----------
alter table public.organizations
  add column if not exists default_currency text not null default 'USD',
  add column if not exists default_units text not null default 'metric',
  add column if not exists default_timezone text not null default 'UTC';

-- The locations.timezone column added in 0004 doubles as the override.
-- Add the remaining two overrides here.
alter table public.locations
  add column if not exists currency_override text,
  add column if not exists units_override text;

-- ---------- Validation constraints ----------
-- units must be one of 'metric' / 'imperial' when present.
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'organizations_default_units_check'
  ) then
    alter table public.organizations
      add constraint organizations_default_units_check
      check (default_units in ('metric', 'imperial'));
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'locations_units_override_check'
  ) then
    alter table public.locations
      add constraint locations_units_override_check
      check (units_override is null or units_override in ('metric', 'imperial'));
  end if;
end$$;
