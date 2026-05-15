-- ===================================================================
-- 0031_sires_catalog.sql
-- Org-scoped master catalog of AI / breeding bulls (sires). One row
-- per unique sire; multiple semen_straws inventory rows can reference
-- the same sire across batches and locations.
--
-- On-farm physical bulls live in animals (sex='M'); this table is for
-- AI / purchased semen sires whose straws sit in our tank.
-- ===================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'sire_status') then
    create type sire_status as enum ('active', 'inactive', 'dead', 'sold');
  end if;
end$$;

create table if not exists public.sires (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  -- NAAB / international stud code (e.g. '014HO07419'). The de-facto
  -- primary key for a sire across the industry.
  naab text not null,
  registered_name text not null,
  short_name text,
  breed_code text references public.breeds_catalog(code) on delete set null,
  status sire_status not null default 'active',
  country_of_origin text,                  -- ISO 3166-1 alpha-2 (US, NL, etc.)
  owner_company text,                      -- ABS / Genex / CRV / Semex / etc.
  -- Performance traits (Holstein conventions; null for non-Holsteins).
  -- Predicted Transmitting Ability — what the bull adds to the herd avg.
  ptam_milk_kg numeric(7, 2),              -- PTA milk in kg
  ptam_fat_kg numeric(6, 3),               -- PTA fat in kg
  ptam_protein_kg numeric(6, 3),           -- PTA protein in kg
  ptam_scs numeric(4, 2),                  -- Somatic cell score (lower is better)
  ptam_dpr numeric(5, 2),                  -- Daughter pregnancy rate
  ptam_calving_ease_pct numeric(5, 2),     -- Sire calving ease %
  ptam_productive_life numeric(5, 2),      -- Months of productive life
  net_merit numeric(8, 2),                 -- NM$ — overall economic index
  -- Bookkeeping
  photo_url text,
  notes text,
  is_seed boolean not null default false,  -- ship-with-the-product rows
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, naab)
);

create index if not exists sires_org_status_idx
  on public.sires (organization_id, status);
create index if not exists sires_naab_idx
  on public.sires (naab);

drop trigger if exists sires_set_updated_at on public.sires;
create trigger sires_set_updated_at
  before update on public.sires
  for each row execute function public.set_updated_at();

alter table public.sires enable row level security;

drop policy if exists sires_select on public.sires;
create policy sires_select on public.sires for select
  using (
    public.auth_role() = 'super_admin'
    or organization_id is null
    or organization_id = public.auth_org_id()
  );

drop policy if exists sires_write on public.sires;
create policy sires_write on public.sires for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

-- Link semen_straws → sires (nullable; legacy rows can be backfilled
-- later by joining naab).
do $$ begin
  alter table public.semen_straws
    add column if not exists sire_id uuid references public.sires(id) on delete set null;
exception when undefined_table then null; end $$;

create index if not exists semen_straws_sire_idx
  on public.semen_straws (sire_id);

comment on table public.sires is
  'Org-scoped master catalog of AI / breeding sires. Multiple semen_straws batches reference the same sire.';
