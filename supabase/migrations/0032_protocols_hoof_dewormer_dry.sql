-- ===================================================================
-- 0032_protocols_hoof_dewormer_dry.sql
-- Three more protocol tables to round out the SOP library that vax /
-- treatment / repro already provided in migration 0019. Same shape:
-- org-scoped, slug-unique per org, seedable, jsonb schedule.
--   1. org_hoof_trim_protocols  — routine claw work schedule per class
--   2. org_deworming_protocols  — anthelmintic schedule + drug WD
--   3. org_dry_off_protocols    — dry-off treatment + sealant + timing
-- ===================================================================

-- -------------------------------------------------------------------
-- Hoof trim protocols
-- -------------------------------------------------------------------
create table if not exists public.org_hoof_trim_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  target_class text not null,             -- 'lactating' / 'dry' / 'heifer' / 'fresh'
  -- Frequency-style schedule:
  --   [{"basis":"days_in_milk","at":50,"label":"Pre-breeding trim"},
  --    {"basis":"days_relative_to_dry_off","at":-30,"label":"Pre-dry trim"}]
  schedule jsonb not null default '[]'::jsonb,
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create unique index if not exists org_hoof_trim_protocols_seed_slug_idx
  on public.org_hoof_trim_protocols(slug) where organization_id is null;

alter table public.org_hoof_trim_protocols enable row level security;
drop policy if exists org_hoof_trim_protocols_select on public.org_hoof_trim_protocols;
create policy org_hoof_trim_protocols_select on public.org_hoof_trim_protocols for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_hoof_trim_protocols_write on public.org_hoof_trim_protocols;
create policy org_hoof_trim_protocols_write on public.org_hoof_trim_protocols for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_hoof_trim_protocols (organization_id, slug, name, target_class, schedule, is_seed, description) values
  (null, 'twice-yearly', 'Twice-yearly maintenance', 'lactating',
    '[{"basis":"days_in_milk","at":50,"label":"Pre-breeding trim"},{"basis":"days_in_milk","at":180,"label":"Mid-lactation trim"}]'::jsonb,
    true, 'Industry-standard: pre-breeding (~50 DIM) and mid-lactation (~180 DIM).'),
  (null, 'pre-dry-off', 'Pre-dry-off trim', 'lactating',
    '[{"basis":"days_relative_to_dry_off","at":-30,"label":"Trim 30 d before dry-off"}]'::jsonb,
    true, 'Trim one month before dry-off so cows enter dry period sound.'),
  (null, 'heifer-pre-calving', 'Heifer pre-calving', 'heifer',
    '[{"basis":"days_relative_to_calving","at":-60,"label":"Pre-calving"}]'::jsonb,
    true, 'First trim 60 d before first calving.')
on conflict (slug) where organization_id is null do update set
  name = excluded.name, target_class = excluded.target_class,
  schedule = excluded.schedule, description = excluded.description;

-- -------------------------------------------------------------------
-- Deworming protocols
-- -------------------------------------------------------------------
create table if not exists public.org_deworming_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  target_class text not null,                  -- 'lactating' / 'dry' / 'heifer' / 'calf'
  -- Schedule items can carry drug + dose + withdrawal:
  --   [{"basis":"age_days","at":60,"drug":"Fenbendazole","dose":"5 mg/kg","route":"PO",
  --     "withdrawal_milk_hours":0,"withdrawal_meat_days":8}]
  schedule jsonb not null default '[]'::jsonb,
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create unique index if not exists org_deworming_protocols_seed_slug_idx
  on public.org_deworming_protocols(slug) where organization_id is null;

alter table public.org_deworming_protocols enable row level security;
drop policy if exists org_deworming_protocols_select on public.org_deworming_protocols;
create policy org_deworming_protocols_select on public.org_deworming_protocols for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_deworming_protocols_write on public.org_deworming_protocols;
create policy org_deworming_protocols_write on public.org_deworming_protocols for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_deworming_protocols (organization_id, slug, name, target_class, schedule, is_seed, description) values
  (null, 'calf-starter', 'Calf starter (60 + 180 d)', 'calf',
    '[{"basis":"age_days","at":60,"drug":"Fenbendazole","dose":"5 mg/kg","route":"PO","withdrawal_milk_hours":0,"withdrawal_meat_days":8},
      {"basis":"age_days","at":180,"drug":"Eprinomectin","dose":"500 mcg/kg topical","route":"topical","withdrawal_milk_hours":0,"withdrawal_meat_days":0}]'::jsonb,
    true, 'Two-dose calf-rearing schedule covering nematodes and lungworm.'),
  (null, 'lactating-spring-fall', 'Lactating spring + autumn', 'lactating',
    '[{"basis":"seasonal","at":"spring","drug":"Eprinomectin","dose":"500 mcg/kg topical","route":"topical","withdrawal_milk_hours":0,"withdrawal_meat_days":0},
      {"basis":"seasonal","at":"autumn","drug":"Eprinomectin","dose":"500 mcg/kg topical","route":"topical","withdrawal_milk_hours":0,"withdrawal_meat_days":0}]'::jsonb,
    true, 'Zero-milk-withdrawal anthelmintic twice yearly.'),
  (null, 'heifer-pre-calving', 'Heifer pre-calving', 'heifer',
    '[{"basis":"days_relative_to_calving","at":-30,"drug":"Eprinomectin","dose":"500 mcg/kg topical","route":"topical","withdrawal_milk_hours":0,"withdrawal_meat_days":0}]'::jsonb,
    true, 'Single dose 4 weeks before first calving.')
on conflict (slug) where organization_id is null do update set
  name = excluded.name, target_class = excluded.target_class,
  schedule = excluded.schedule, description = excluded.description;

-- -------------------------------------------------------------------
-- Dry-off protocols
-- -------------------------------------------------------------------
create table if not exists public.org_dry_off_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  approach_days int not null default 60,       -- typical days_before_calving
  -- treatment is jsonb so each quarter can carry a different decision
  -- (selective dry-cow therapy), plus optional teat sealant.
  -- Example:
  --   {"strategy":"blanket","antibiotic":"Cefquinome 150 mg/quarter","sealant":"Bismuth subnitrate","milk_withdrawal_hours":0}
  treatment jsonb not null default '{}'::jsonb,
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create unique index if not exists org_dry_off_protocols_seed_slug_idx
  on public.org_dry_off_protocols(slug) where organization_id is null;

alter table public.org_dry_off_protocols enable row level security;
drop policy if exists org_dry_off_protocols_select on public.org_dry_off_protocols;
create policy org_dry_off_protocols_select on public.org_dry_off_protocols for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_dry_off_protocols_write on public.org_dry_off_protocols;
create policy org_dry_off_protocols_write on public.org_dry_off_protocols for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_dry_off_protocols (organization_id, slug, name, approach_days, treatment, is_seed, description) values
  (null, 'blanket-with-sealant', 'Blanket DCT + sealant', 60,
    '{"strategy":"blanket","antibiotic":"Cefquinome 150 mg/quarter (LA)","sealant":"Bismuth subnitrate","applied_to":"all quarters"}'::jsonb,
    true, 'Long-acting cephalosporin in all four quarters at dry-off plus internal teat sealant.'),
  (null, 'selective-scc-driven', 'Selective DCT (SCC-driven)', 60,
    '{"strategy":"selective","criteria":"last test-day SCC > 200,000 OR clinical case during lactation","antibiotic_if_criteria_met":"Cefquinome 150 mg/quarter (LA)","sealant":"Bismuth subnitrate (all cows)"}'::jsonb,
    true, 'Antibiotic only for cows above SCC threshold; sealant on every quarter regardless.'),
  (null, 'sealant-only', 'Sealant only (no antibiotic)', 60,
    '{"strategy":"no_antibiotic","sealant":"Bismuth subnitrate","applied_to":"all quarters"}'::jsonb,
    true, 'Antibiotic-free dry-off (organic / withdrawal-sensitive). Sealant only.')
on conflict (slug) where organization_id is null do update set
  name = excluded.name, approach_days = excluded.approach_days,
  treatment = excluded.treatment, description = excluded.description;

comment on table public.org_hoof_trim_protocols is 'Org-scoped routine claw-work schedules per class.';
comment on table public.org_deworming_protocols is 'Org-scoped anthelmintic schedules per class with WD info.';
comment on table public.org_dry_off_protocols  is 'Org-scoped dry-off SOP — antibiotic + sealant + timing.';
