-- =====================================================================
-- FarmInsight consolidated migration (0004 → 0018)
-- =====================================================================
-- Apply this single file in the Supabase SQL editor to bring a
-- database from the post-PR #9 state up to current master.
-- All statements are idempotent.
-- =====================================================================


-- ------------------------------------------------------------------
-- File: 0004_locations_wizard_modules.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0004 — Wizard state, module toggles, and area capture on Locations
-- =====================================================================

-- ---------- setup_step enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'location_setup_step') then
    create type location_setup_step as enum (
      'identity',
      'recording',
      'import_choice',
      'import',
      'herd_profile',
      'group_strategy',
      'rules',
      'capacity_plan',
      'barns',
      'pens',
      'arable_parcels',
      'done'
    );
  end if;
end$$;

-- ---------- new columns on locations ----------
alter table public.locations
  add column if not exists manages_livestock boolean not null default true,
  add column if not exists manages_crops boolean not null default false,
  add column if not exists livestock_area_hectares numeric(10, 2),
  add column if not exists arable_area_hectares numeric(10, 2),
  add column if not exists timezone text,
  add column if not exists setup_step location_setup_step not null default 'identity',
  add column if not exists setup_completed_at timestamptz;

-- Existing rows created before this migration get setup_completed_at = now()
-- so they don't suddenly show an onboarding banner. New rows start at 'identity'.
update public.locations
   set setup_step = 'done',
       setup_completed_at = coalesce(setup_completed_at, now())
 where setup_completed_at is null
   and created_at < now() - interval '1 minute';


-- ------------------------------------------------------------------
-- File: 0005_org_catalogs_presets.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0005 — Organization-level catalogs and presets
-- =====================================================================
-- Two layers:
--   1. Global catalogs (breeds, diagnoses, routes, cull reasons).
--      Read-only to all authenticated users; only super_admin may edit
--      the seed. Future PRs may add per-org overlays.
--   2. Per-org presets (capacity defaults, group strategy presets,
--      pricing scheme templates). Seed rows have organization_id = null
--      and are visible to everyone as templates. Orgs may instantiate
--      copies later.

-- ---------------------------------------------------------------------
-- Global catalogs
-- ---------------------------------------------------------------------

create table if not exists public.breeds_catalog (
  code text primary key,
  name text not null,
  scientific_name text,
  source text,
  display_order int not null default 0
);

create table if not exists public.diagnoses_catalog (
  code text primary key,
  name text not null,
  category text not null,
  description text,
  source text,
  display_order int not null default 0
);

create table if not exists public.routes_catalog (
  code text primary key,
  name text not null,
  description text,
  display_order int not null default 0
);

create table if not exists public.cull_reasons_catalog (
  code text primary key,
  name text not null,
  category text not null,
  description text,
  source text,
  display_order int not null default 0
);

alter table public.breeds_catalog enable row level security;
alter table public.diagnoses_catalog enable row level security;
alter table public.routes_catalog enable row level security;
alter table public.cull_reasons_catalog enable row level security;

drop policy if exists breeds_catalog_select on public.breeds_catalog;
create policy breeds_catalog_select on public.breeds_catalog for select using (true);
drop policy if exists breeds_catalog_write on public.breeds_catalog;
create policy breeds_catalog_write on public.breeds_catalog for all
  using (public.auth_role() = 'super_admin')
  with check (public.auth_role() = 'super_admin');

drop policy if exists diagnoses_catalog_select on public.diagnoses_catalog;
create policy diagnoses_catalog_select on public.diagnoses_catalog for select using (true);
drop policy if exists diagnoses_catalog_write on public.diagnoses_catalog;
create policy diagnoses_catalog_write on public.diagnoses_catalog for all
  using (public.auth_role() = 'super_admin')
  with check (public.auth_role() = 'super_admin');

drop policy if exists routes_catalog_select on public.routes_catalog;
create policy routes_catalog_select on public.routes_catalog for select using (true);
drop policy if exists routes_catalog_write on public.routes_catalog;
create policy routes_catalog_write on public.routes_catalog for all
  using (public.auth_role() = 'super_admin')
  with check (public.auth_role() = 'super_admin');

drop policy if exists cull_reasons_catalog_select on public.cull_reasons_catalog;
create policy cull_reasons_catalog_select on public.cull_reasons_catalog for select using (true);
drop policy if exists cull_reasons_catalog_write on public.cull_reasons_catalog;
create policy cull_reasons_catalog_write on public.cull_reasons_catalog for all
  using (public.auth_role() = 'super_admin')
  with check (public.auth_role() = 'super_admin');

-- ---------- Seed: breeds (NAAB Uniform Breed Codes) ----------
insert into public.breeds_catalog (code, name, scientific_name, source, display_order) values
  ('HO', 'Holstein', 'Bos taurus', 'NAAB', 10),
  ('JE', 'Jersey', 'Bos taurus', 'NAAB', 20),
  ('BS', 'Brown Swiss', 'Bos taurus', 'NAAB', 30),
  ('AY', 'Ayrshire', 'Bos taurus', 'NAAB', 40),
  ('GU', 'Guernsey', 'Bos taurus', 'NAAB', 50),
  ('MS', 'Milking Shorthorn', 'Bos taurus', 'NAAB', 60),
  ('RW', 'Red & White Holstein', 'Bos taurus', 'NAAB', 70),
  ('HF', 'Holstein Friesian', 'Bos taurus', 'NAAB', 80),
  ('XX', 'Crossbred', null, 'NAAB', 900),
  ('HJ', 'Holstein × Jersey', null, 'derived', 910),
  ('JX', 'Jersey Cross', null, 'derived', 920)
on conflict (code) do update set
  name = excluded.name,
  scientific_name = excluded.scientific_name,
  source = excluded.source,
  display_order = excluded.display_order;

-- ---------- Seed: diagnoses (ICAR Section 7.1 dairy health code subset) ----------
insert into public.diagnoses_catalog (code, name, category, source, display_order) values
  ('MAST-CM',   'Clinical Mastitis',        'mammary',       'ICAR 7.1', 10),
  ('MAST-SCM',  'Subclinical Mastitis',     'mammary',       'ICAR 7.1', 11),
  ('TEAT-INJ',  'Teat Injury',              'mammary',       'ICAR 7.1', 12),
  ('DA-LEFT',   'Left Displaced Abomasum',  'digestive',     'ICAR 7.1', 20),
  ('DA-RIGHT',  'Right Displaced Abomasum', 'digestive',     'ICAR 7.1', 21),
  ('INDIG',     'Indigestion',              'digestive',     'ICAR 7.1', 22),
  ('DIA',       'Diarrhea',                 'digestive',     'ICAR 7.1', 23),
  ('ACID',      'Subacute Rumen Acidosis',  'digestive',     'ICAR 7.1', 24),
  ('KET',       'Ketosis',                  'metabolic',     'ICAR 7.1', 30),
  ('MF',        'Milk Fever (Hypocalcemia)','metabolic',     'ICAR 7.1', 31),
  ('FAT-LIV',   'Fatty Liver',              'metabolic',     'ICAR 7.1', 32),
  ('LAM',       'Lameness (general)',       'locomotion',    'ICAR 7.1', 40),
  ('DD',        'Digital Dermatitis',       'locomotion',    'ICAR 7.1', 41),
  ('FR',        'Foot Rot',                 'locomotion',    'ICAR 7.1', 42),
  ('SU',        'Sole Ulcer',               'locomotion',    'ICAR 7.1', 43),
  ('WL',        'White Line Disease',       'locomotion',    'ICAR 7.1', 44),
  ('RP',        'Retained Placenta',        'reproductive',  'ICAR 7.1', 50),
  ('MET',       'Metritis',                 'reproductive',  'ICAR 7.1', 51),
  ('ENDO',      'Endometritis',             'reproductive',  'ICAR 7.1', 52),
  ('ABOR',      'Abortion',                 'reproductive',  'ICAR 7.1', 53),
  ('DYSTO',     'Dystocia',                 'reproductive',  'ICAR 7.1', 54),
  ('CYST',      'Cystic Ovary',             'reproductive',  'ICAR 7.1', 55),
  ('ANEST',     'Anestrus',                 'reproductive',  'ICAR 7.1', 56),
  ('PNEU',      'Pneumonia',                'respiratory',   'ICAR 7.1', 60),
  ('BRD',       'Bovine Respiratory Disease','respiratory',  'ICAR 7.1', 61),
  ('PINKEYE',   'Pinkeye',                  'other',         'AABP',     70),
  ('SKIN',      'Skin Condition',           'other',         'AABP',     71),
  ('INJURY',    'Injury / Trauma',          'other',         'general',  80)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  source = excluded.source,
  display_order = excluded.display_order;

-- ---------- Seed: routes of administration ----------
insert into public.routes_catalog (code, name, description, display_order) values
  ('IM',  'Intramuscular',     'Injection into the muscle',                 10),
  ('IV',  'Intravenous',       'Injection into a vein',                     20),
  ('SC',  'Subcutaneous',      'Injection under the skin',                  30),
  ('IMM', 'Intramammary',      'Infusion into the mammary gland',           40),
  ('PO',  'Oral',              'Administered by mouth',                     50),
  ('TOP', 'Topical',           'Applied to skin or hooves',                 60),
  ('IU',  'Intrauterine',      'Infusion into the uterus',                  70),
  ('SQ',  'Subconjunctival',   'Injection under the conjunctiva',           80)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order;

-- ---------- Seed: cull reasons (DHIA 9-code + extras) ----------
insert into public.cull_reasons_catalog (code, name, category, source, display_order) values
  ('DIED',     'Died on Farm',            'involuntary', 'DHIA',    10),
  ('REPRO',    'Reproductive Failure',    'involuntary', 'DHIA',    20),
  ('MAST',     'Mastitis',                'involuntary', 'DHIA',    30),
  ('LOWPROD',  'Low Production',          'voluntary',   'DHIA',    40),
  ('FEETLEGS', 'Feet & Legs',             'involuntary', 'DHIA',    50),
  ('INJURY',   'Injury',                  'involuntary', 'DHIA',    60),
  ('DISEASE',  'Other Disease',           'involuntary', 'DHIA',    70),
  ('UDDER',    'Udder Issues',            'involuntary', 'DHIA',    80),
  ('SOLD-D',   'Sold for Dairy',          'voluntary',   'DHIA',    90),
  ('SOLD-B',   'Sold for Beef',           'voluntary',   'derived', 100),
  ('AGE',      'Age',                     'voluntary',   'derived', 110),
  ('TEMP',     'Temperament / Behavior',  'voluntary',   'derived', 120),
  ('BCS',      'Body Condition',          'involuntary', 'derived', 130),
  ('OTHER',    'Other',                   'voluntary',   'general', 999)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  source = excluded.source,
  display_order = excluded.display_order;

-- ---------------------------------------------------------------------
-- Per-org capacity defaults
-- ---------------------------------------------------------------------

create table if not exists public.org_capacity_defaults (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  fresh_stocking_pct      numeric(5, 1) not null default 100.0,
  high_stocking_pct       numeric(5, 1) not null default 110.0,
  mid_stocking_pct        numeric(5, 1) not null default 115.0,
  low_stocking_pct        numeric(5, 1) not null default 115.0,
  dry_close_stocking_pct  numeric(5, 1) not null default 100.0,
  dry_far_stocking_pct    numeric(5, 1) not null default 110.0,
  fresh_bunk_in           numeric(4, 1) not null default 30.0,
  high_bunk_in            numeric(4, 1) not null default 30.0,
  mid_bunk_in             numeric(4, 1) not null default 24.0,
  low_bunk_in             numeric(4, 1) not null default 24.0,
  dry_close_bunk_in       numeric(4, 1) not null default 30.0,
  dry_far_bunk_in         numeric(4, 1) not null default 24.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists org_capacity_defaults_set_updated_at on public.org_capacity_defaults;
create trigger org_capacity_defaults_set_updated_at
  before update on public.org_capacity_defaults
  for each row execute function public.set_updated_at();

alter table public.org_capacity_defaults enable row level security;

drop policy if exists org_capacity_defaults_select on public.org_capacity_defaults;
create policy org_capacity_defaults_select on public.org_capacity_defaults for select
  using (
    public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );

drop policy if exists org_capacity_defaults_write on public.org_capacity_defaults;
create policy org_capacity_defaults_write on public.org_capacity_defaults for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

-- ---------------------------------------------------------------------
-- Group strategy presets (seeds visible to all)
-- ---------------------------------------------------------------------

create table if not exists public.org_group_strategy_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  recommended_min_lactating int,
  recommended_max_lactating int,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create unique index if not exists org_group_strategy_presets_slug_seed_idx
  on public.org_group_strategy_presets (slug) where organization_id is null;

create table if not exists public.org_group_strategy_preset_groups (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.org_group_strategy_presets(id) on delete cascade,
  group_slug text not null,
  group_label text not null,
  group_class text not null,
  display_order int not null default 0,
  rule_predicates jsonb not null default '{}'::jsonb,
  unique (preset_id, group_slug)
);

alter table public.org_group_strategy_presets enable row level security;
alter table public.org_group_strategy_preset_groups enable row level security;

drop policy if exists org_gsp_select on public.org_group_strategy_presets;
create policy org_gsp_select on public.org_group_strategy_presets for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );

drop policy if exists org_gsp_write on public.org_group_strategy_presets;
create policy org_gsp_write on public.org_group_strategy_presets for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

drop policy if exists org_gspg_select on public.org_group_strategy_preset_groups;
create policy org_gspg_select on public.org_group_strategy_preset_groups for select
  using (
    exists (
      select 1 from public.org_group_strategy_presets p
      where p.id = preset_id
        and (
          p.organization_id is null
          or public.auth_role() = 'super_admin'
          or p.organization_id = public.auth_org_id()
        )
    )
  );

drop policy if exists org_gspg_write on public.org_group_strategy_preset_groups;
create policy org_gspg_write on public.org_group_strategy_preset_groups for all
  using (
    exists (
      select 1 from public.org_group_strategy_presets p
      where p.id = preset_id
        and (
          public.auth_role() = 'super_admin'
          or (public.auth_role() = 'admin' and p.organization_id = public.auth_org_id())
        )
    )
  )
  with check (
    exists (
      select 1 from public.org_group_strategy_presets p
      where p.id = preset_id
        and (
          public.auth_role() = 'super_admin'
          or (public.auth_role() = 'admin' and p.organization_id = public.auth_org_id())
        )
    )
  );

-- ---------- Seed group strategy presets ----------
-- Using deterministic inserts so we can attach group rows by slug.

insert into public.org_group_strategy_presets (organization_id, slug, name, description, recommended_min_lactating, recommended_max_lactating, is_seed) values
  (null, 'single-group',  'Single-group TMR',         'One ration for all lactating cows. Right for small herds.', 0,    99,   true),
  (null, '2-group',       '2-group lactating',        'High / Low split. Right for mid-size herds.',                100,  299,  true),
  (null, '3-group',       '3-group lactating',        'High / Mid / Low + transition split.',                       300,  799,  true),
  (null, '4-group',       '4-group lactating + age-split heifers', 'Fresh primip / Fresh multip / High / Mid / Low.', 800, null, true),
  (null, 'custom',        'Custom',                   'Start from an empty group structure.',                       0,    null, true)
on conflict (slug) where organization_id is null do update set
  name = excluded.name,
  description = excluded.description,
  recommended_min_lactating = excluded.recommended_min_lactating,
  recommended_max_lactating = excluded.recommended_max_lactating;

-- Attach groups to each seed preset.
-- (Using INSERT ... SELECT to keep this idempotent against re-runs.)

do $$
declare
  p_single uuid;
  p_2g     uuid;
  p_3g     uuid;
  p_4g     uuid;
begin
  select id into p_single from public.org_group_strategy_presets where organization_id is null and slug = 'single-group';
  select id into p_2g     from public.org_group_strategy_presets where organization_id is null and slug = '2-group';
  select id into p_3g     from public.org_group_strategy_presets where organization_id is null and slug = '3-group';
  select id into p_4g     from public.org_group_strategy_presets where organization_id is null and slug = '4-group';

  -- single-group
  insert into public.org_group_strategy_preset_groups (preset_id, group_slug, group_label, group_class, display_order, rule_predicates) values
    (p_single, 'lactating', 'Lactating', 'lactating', 10, '{"dim_min": 0}'::jsonb),
    (p_single, 'dry',       'Dry',       'dry',       20, '{"dry": true}'::jsonb),
    (p_single, 'hospital',  'Hospital',  'special',   30, '{"health_flag": true}'::jsonb),
    (p_single, 'maternity', 'Maternity', 'special',   40, '{"pregnancy_days_min": 275}'::jsonb),
    (p_single, 'heifer',    'Heifer',    'heifer',    50, '{"parity": 0}'::jsonb),
    (p_single, 'calf',      'Calf',      'calf',      60, '{"age_months_max": 6}'::jsonb)
  on conflict (preset_id, group_slug) do update set
    group_label = excluded.group_label,
    group_class = excluded.group_class,
    display_order = excluded.display_order,
    rule_predicates = excluded.rule_predicates;

  -- 2-group
  insert into public.org_group_strategy_preset_groups (preset_id, group_slug, group_label, group_class, display_order, rule_predicates) values
    (p_2g, 'fresh',     'Fresh',     'lactating', 10, '{"dim_min": 0, "dim_max": 21}'::jsonb),
    (p_2g, 'high',      'High',      'lactating', 20, '{"dim_min": 22, "dim_max": 150}'::jsonb),
    (p_2g, 'low',       'Low',       'lactating', 30, '{"dim_min": 151}'::jsonb),
    (p_2g, 'dry',       'Dry',       'dry',       40, '{"dry": true}'::jsonb),
    (p_2g, 'hospital',  'Hospital',  'special',   50, '{"health_flag": true}'::jsonb),
    (p_2g, 'maternity', 'Maternity', 'special',   60, '{"pregnancy_days_min": 275}'::jsonb),
    (p_2g, 'heifer',    'Heifer',    'heifer',    70, '{"parity": 0}'::jsonb),
    (p_2g, 'calf',      'Calf',      'calf',      80, '{"age_months_max": 6}'::jsonb)
  on conflict (preset_id, group_slug) do update set
    group_label = excluded.group_label,
    group_class = excluded.group_class,
    display_order = excluded.display_order,
    rule_predicates = excluded.rule_predicates;

  -- 3-group
  insert into public.org_group_strategy_preset_groups (preset_id, group_slug, group_label, group_class, display_order, rule_predicates) values
    (p_3g, 'fresh',     'Fresh',     'lactating',  10, '{"dim_min": 0, "dim_max": 21}'::jsonb),
    (p_3g, 'high',      'High',      'lactating',  20, '{"dim_min": 22, "dim_max": 150}'::jsonb),
    (p_3g, 'mid',       'Mid',       'lactating',  30, '{"dim_min": 151, "dim_max": 250}'::jsonb),
    (p_3g, 'low',       'Low',       'lactating',  40, '{"dim_min": 251}'::jsonb),
    (p_3g, 'far-off',   'Far-off',   'dry',        50, '{"dry": true, "pregnancy_days_max": 249}'::jsonb),
    (p_3g, 'close-up',  'Close-up',  'transition', 60, '{"dry": true, "pregnancy_days_min": 250}'::jsonb),
    (p_3g, 'hospital',  'Hospital',  'special',    70, '{"health_flag": true}'::jsonb),
    (p_3g, 'maternity', 'Maternity', 'special',    80, '{"pregnancy_days_min": 275}'::jsonb),
    (p_3g, 'heifer-1',  'Heifer 0-12mo', 'heifer', 90, '{"parity": 0, "age_months_min": 0, "age_months_max": 12}'::jsonb),
    (p_3g, 'heifer-2',  'Heifer 12-18mo','heifer', 100, '{"parity": 0, "age_months_min": 12, "age_months_max": 18}'::jsonb),
    (p_3g, 'heifer-3',  'Heifer 18+mo',  'heifer', 110, '{"parity": 0, "age_months_min": 18}'::jsonb),
    (p_3g, 'calf',      'Calf',      'calf',       120, '{"age_months_max": 6}'::jsonb)
  on conflict (preset_id, group_slug) do update set
    group_label = excluded.group_label,
    group_class = excluded.group_class,
    display_order = excluded.display_order,
    rule_predicates = excluded.rule_predicates;

  -- 4-group
  insert into public.org_group_strategy_preset_groups (preset_id, group_slug, group_label, group_class, display_order, rule_predicates) values
    (p_4g, 'fresh-primip',  'Fresh — Primiparous', 'lactating',  10, '{"dim_min": 0, "dim_max": 21, "parity": 1}'::jsonb),
    (p_4g, 'fresh-multip',  'Fresh — Multiparous', 'lactating',  20, '{"dim_min": 0, "dim_max": 21, "parity_min": 2}'::jsonb),
    (p_4g, 'high',          'High',                'lactating',  30, '{"dim_min": 22, "dim_max": 150}'::jsonb),
    (p_4g, 'mid',           'Mid',                 'lactating',  40, '{"dim_min": 151, "dim_max": 250}'::jsonb),
    (p_4g, 'low',           'Low',                 'lactating',  50, '{"dim_min": 251}'::jsonb),
    (p_4g, 'far-off',       'Far-off',             'dry',        60, '{"dry": true, "pregnancy_days_max": 249}'::jsonb),
    (p_4g, 'close-up',      'Close-up',            'transition', 70, '{"dry": true, "pregnancy_days_min": 250}'::jsonb),
    (p_4g, 'hospital',      'Hospital',            'special',    80, '{"health_flag": true}'::jsonb),
    (p_4g, 'maternity',     'Maternity',           'special',    90, '{"pregnancy_days_min": 275}'::jsonb),
    (p_4g, 'calf',          'Calf (0-2mo)',        'calf',       100, '{"age_months_max": 2}'::jsonb),
    (p_4g, 'weaned',        'Weaned (2-6mo)',      'calf',       110, '{"age_months_min": 2, "age_months_max": 6}'::jsonb),
    (p_4g, 'breeder',       'Breeder (6-15mo)',    'heifer',     120, '{"parity": 0, "age_months_min": 6, "age_months_max": 15}'::jsonb),
    (p_4g, 'bred-heifer',   'Bred heifer (15+mo)', 'heifer',     130, '{"parity": 0, "age_months_min": 15}'::jsonb)
  on conflict (preset_id, group_slug) do update set
    group_label = excluded.group_label,
    group_class = excluded.group_class,
    display_order = excluded.display_order,
    rule_predicates = excluded.rule_predicates;
end$$;

-- ---------------------------------------------------------------------
-- Pricing scheme templates (seeds visible to all)
-- ---------------------------------------------------------------------

create table if not exists public.org_pricing_scheme_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  country_code text,
  currency text not null,
  base_unit text not null,           -- 'kg' | 'L' | 'lb' | 'cwt' | 'MS-kg'
  correction_method text not null,   -- 'raw' | 'fcm_3.5' | 'fcm_4' | 'ecm_nrc' | 'ecm_tr' | 'ms' | 'ts' | 'fat_corrected' | 'snf_corrected' | 'custom'
  description text,
  default_component_bonuses jsonb not null default '{}'::jsonb,
  default_scc_tiers jsonb not null default '[]'::jsonb,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create unique index if not exists org_pst_slug_seed_idx
  on public.org_pricing_scheme_templates (slug) where organization_id is null;

alter table public.org_pricing_scheme_templates enable row level security;

drop policy if exists org_pst_select on public.org_pricing_scheme_templates;
create policy org_pst_select on public.org_pricing_scheme_templates for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );

drop policy if exists org_pst_write on public.org_pricing_scheme_templates;
create policy org_pst_write on public.org_pricing_scheme_templates for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_pricing_scheme_templates (organization_id, slug, name, country_code, currency, base_unit, correction_method, description, is_seed) values
  (null, 'us-fmmo-class3',  'US — FMMO Class III',          'US', 'USD', 'cwt',   'raw',           'Federal Milk Marketing Order Class III component pricing. Fat, protein, and other-solids priced separately with SCC adjustment.', true),
  (null, 'eu-component',    'EU — Component pricing',       'EU', 'EUR', 'kg',    'raw',           'Generic European component scheme. € per kg-fat + € per kg-protein + base, with SCC and TBC tiers.', true),
  (null, 'nz-fonterra-ms',  'NZ — Fonterra milksolids',     'NZ', 'NZD', 'MS-kg', 'ms',            'Per kg milksolids (fat + protein kg) with hygiene grade bonus.', true),
  (null, 'india-coop-fat',  'India — Cooperative fat-corrected', 'IN', 'INR', 'L', 'fat_corrected', 'Per liter, corrected to 6% fat base (Amul-style). SNF adjustments common.', true),
  (null, 'pakistan-fat',    'Pakistan — Fat-corrected',     'PK', 'PKR', 'L',     'fat_corrected', 'Per liter, corrected to 6% fat base.', true),
  (null, 'custom',          'Custom',                       null, 'USD', 'kg',    'raw',           'Start from an empty pricing scheme.', true)
on conflict (slug) where organization_id is null do update set
  name = excluded.name,
  country_code = excluded.country_code,
  currency = excluded.currency,
  base_unit = excluded.base_unit,
  correction_method = excluded.correction_method,
  description = excluded.description;


-- ------------------------------------------------------------------
-- File: 0006_org_defaults_loc_overrides.sql
-- ------------------------------------------------------------------

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


-- ------------------------------------------------------------------
-- File: 0007_recording_profiles.sql
-- ------------------------------------------------------------------

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


-- ------------------------------------------------------------------
-- File: 0008_herd_profile_groups.sql
-- ------------------------------------------------------------------

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


-- ------------------------------------------------------------------
-- File: 0009_barns.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0009 — Barns (physical shells)
-- =====================================================================
-- docs/plan.md §4.2: Dairyland Initiative / UMN / Cornell field set.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'barn_type') then
    create type barn_type as enum (
      'freestall', 'tie_stall', 'bedded_pack', 'compost',
      'drylot', 'robotic', 'parlor', 'calf',
      'maternity_transition', 'hospital', 'heifer', 'hutches'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'row_configuration') then
    create type row_configuration as enum ('2_row', '3_row', '4_row', '6_row', 'other');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ventilation_type') then
    create type ventilation_type as enum ('natural', 'tunnel', 'cross', 'hybrid');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parlor_type') then
    create type parlor_type as enum ('parallel', 'herringbone', 'rotary', 'robot', 'swing', 'none');
  end if;
end$$;

create table if not exists public.barns (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  barn_code text,
  type barn_type not null,
  row_configuration row_configuration,
  -- Counts
  freestall_count int,
  headlock_count int,
  loafing_area_sqft int,
  holding_pen_capacity int,
  -- Stalls
  stall_surface text,           -- sand / mattress / waterbed / pack
  bedding_type text,
  stall_length_ft numeric(4, 1),
  stall_width_in numeric(4, 1),
  neck_rail_height_in numeric(4, 1),
  -- Bunk
  bunk_type text,               -- drive_through / feed_alley / fenceline
  bunk_total_linear_ft numeric(6, 1),
  -- Floor / manure
  floor_type text,              -- grooved_concrete / rubber / sand_laneway
  manure_handling text,         -- scrape / flush / vacuum / robot
  -- Ventilation
  ventilation_type ventilation_type,
  fan_count int,
  fan_diameter_in numeric(4, 1),
  soaker_lines_present boolean not null default false,
  soaker_nozzle_height_in numeric(4, 1),
  -- Cow comfort
  sprinklers boolean not null default false,
  fans_over_stalls boolean not null default false,
  brushes_count int,
  footbath_present boolean not null default false,
  -- Parlor barns only
  parlor_type parlor_type,
  parlor_stalls int,
  robot_count int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists barns_location_idx on public.barns(location_id);

drop trigger if exists barns_set_updated_at on public.barns;
create trigger barns_set_updated_at
  before update on public.barns
  for each row execute function public.set_updated_at();

alter table public.barns enable row level security;

drop policy if exists barns_select on public.barns;
create policy barns_select on public.barns for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists barns_write on public.barns;
create policy barns_write on public.barns for all
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


-- ------------------------------------------------------------------
-- File: 0010_pens.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0010 — Pens (industry-standard pen-type taxonomy)
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pen_type') then
    create type pen_type as enum (
      'milking', 'dry', 'close_up', 'far_off', 'fresh',
      'hospital', 'maternity', 'AI_breeding', 'bull',
      'heifer', 'calf', 'other'
    );
  end if;
end$$;

create table if not exists public.pens (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  barn_id uuid references public.barns(id) on delete set null,
  group_id uuid references public.location_groups(id) on delete set null,
  name text not null,
  pen_code text,
  type pen_type not null default 'milking',
  capacity_head int,
  -- Pen-type side-effect flags
  is_AI_pen boolean not null default false,
  is_BULL_pen boolean not null default false,
  is_DRY_pen boolean not null default false,
  is_HOSP_pen boolean not null default false,
  is_FRESH_pen boolean not null default false,
  is_placeholder boolean not null default false,
  tmr_recipe_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name),
  constraint pens_ai_bull_exclusive check (not (is_AI_pen and is_BULL_pen))
);

create index if not exists pens_location_idx on public.pens(location_id);
create index if not exists pens_barn_idx on public.pens(barn_id);
create index if not exists pens_group_idx on public.pens(group_id);

drop trigger if exists pens_set_updated_at on public.pens;
create trigger pens_set_updated_at
  before update on public.pens
  for each row execute function public.set_updated_at();

alter table public.pens enable row level security;

drop policy if exists pens_select on public.pens;
create policy pens_select on public.pens for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists pens_write on public.pens;
create policy pens_write on public.pens for all
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


-- ------------------------------------------------------------------
-- File: 0011_arable_parcels.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0011 — Arable parcels (crop module foundation)
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parcel_status') then
    create type parcel_status as enum ('active', 'fallow', 'archived');
  end if;
end$$;

create table if not exists public.arable_parcels (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  parcel_code text,
  area_hectares numeric(10, 2),
  status parcel_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists arable_parcels_location_idx on public.arable_parcels(location_id);

drop trigger if exists arable_parcels_set_updated_at on public.arable_parcels;
create trigger arable_parcels_set_updated_at
  before update on public.arable_parcels
  for each row execute function public.set_updated_at();

alter table public.arable_parcels enable row level security;

drop policy if exists arable_parcels_select on public.arable_parcels;
create policy arable_parcels_select on public.arable_parcels for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists arable_parcels_write on public.arable_parcels;
create policy arable_parcels_write on public.arable_parcels for all
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


-- ------------------------------------------------------------------
-- File: 0012_animal_data_schema.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0012 — Comprehensive animal-data schema (event-based)
-- =====================================================================
-- docs/plan.md §4.4: animals = stable attributes only; everything
-- time-bound is an event in its own table. Every event row carries
-- a source + source_external_id for idempotent re-imports.

-- ---------- Reusable source tracking ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_source') then
    create type event_source as enum ('manual', 'mobile', 'excel', 'api', 'import_snapshot');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'animal_sex') then
    create type animal_sex as enum ('female', 'male', 'freemartin', 'castrated');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'animal_status') then
    create type animal_status as enum ('active', 'sold', 'dead', 'culled', 'reference');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'animal_origin') then
    create type animal_origin as enum ('born_on_farm', 'purchased', 'imported', 'leased', 'other');
  end if;
end$$;

-- ---------- animals (stable identity) ----------
create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  current_pen_id uuid references public.pens(id) on delete set null,
  current_group_id uuid references public.location_groups(id) on delete set null,
  animal_id text not null,                    -- on-farm management number (join key)
  name text,
  official_id text,                            -- USDA 840 / ISO / CCIA
  registration_number text,
  breed_code text references public.breeds_catalog(code) on delete set null,
  sex animal_sex not null,
  birth_date date not null,
  color_markings text,
  origin animal_origin not null default 'born_on_farm',
  source_farm text,
  entry_date date not null,
  purchase_price numeric(12, 2),
  status animal_status not null default 'active',
  status_date date,
  -- Lineage
  sire_naab text,
  sire_name text,
  dam_animal_id uuid references public.animals(id) on delete set null,
  dam_tag_external text,
  recipient_dam_animal_id uuid references public.animals(id) on delete set null,
  et_flag boolean not null default false,
  ivf_flag boolean not null default false,
  -- Lightweight current state cache (mirrored from events for quick reads;
  -- the events are authoritative)
  current_lactation int,
  last_calving_date date,
  -- Genetics shortcuts
  a2_status text,
  polled text,
  -- Provenance
  source event_source not null default 'manual',
  source_external_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, animal_id)
);

create index if not exists animals_status_idx on public.animals(location_id, status);
create index if not exists animals_pen_idx on public.animals(current_pen_id);
create index if not exists animals_group_idx on public.animals(current_group_id);

drop trigger if exists animals_set_updated_at on public.animals;
create trigger animals_set_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

-- ---------- Helper macro: standard RLS for animal-linked tables ----------
-- We can't define a macro in plain SQL, so each event table gets the
-- same select/write pair generated below.

-- ---------- lactations ----------
create table if not exists public.lactations (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  parity int not null,
  fresh_date date not null,
  dry_date date,
  days_dry_prior int,
  me305_milk numeric(10, 1),
  me305_fat numeric(10, 1),
  me305_protein numeric(10, 1),
  peak_milk numeric(8, 1),
  peak_dim int,
  avg_scc int,
  is_synthesized boolean not null default false,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now(),
  unique (animal_id, parity)
);
create index if not exists lactations_animal_idx on public.lactations(animal_id);

-- ---------- test_days ----------
create table if not exists public.test_days (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  test_date date not null,
  dim int,
  milk_kg numeric(8, 2) not null,
  fat_pct numeric(5, 2),
  protein_pct numeric(5, 2),
  lactose_pct numeric(5, 2),
  scc int,
  mun numeric(6, 2),
  test_plan text,
  milkings_per_day int,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now(),
  unique (animal_id, test_date)
);
create index if not exists test_days_animal_date_idx on public.test_days(animal_id, test_date);

-- ---------- milkings (per cow per milking) ----------
create table if not exists public.milkings (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  milking_at timestamptz not null,
  milking_session int,
  yield_kg numeric(8, 2) not null,
  conductivity numeric(8, 2),
  fat_pct numeric(5, 2),
  protein_pct numeric(5, 2),
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now(),
  unique (animal_id, milking_at)
);
create index if not exists milkings_animal_at_idx on public.milkings(animal_id, milking_at desc);
create index if not exists milkings_location_at_idx on public.milkings(location_id, milking_at desc);

-- ---------- repro_events ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'repro_event_type') then
    create type repro_event_type as enum (
      'heat', 'breeding', 'preg_check', 'abortion', 'do_not_breed', 'fresh', 'dry_off'
    );
  end if;
end$$;

create table if not exists public.repro_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  event_date date not null,
  event_type repro_event_type not null,
  parity_at_event int,
  dim_at_event int,
  sire_naab text,
  semen_type text,
  service_number int,
  technician text,
  sync_protocol text,
  preg_check_method text,
  result text,
  days_pregnant int,
  notes text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists repro_events_animal_date_idx
  on public.repro_events(animal_id, event_date desc);

-- ---------- calvings ----------
create table if not exists public.calvings (
  id uuid primary key default gen_random_uuid(),
  dam_animal_id uuid not null references public.animals(id) on delete cascade,
  calving_date date not null,
  parity int not null,
  calving_ease int,
  twin_flag boolean not null default false,
  calf_animal_id uuid references public.animals(id) on delete set null,
  calf_sex animal_sex,
  stillborn boolean not null default false,
  calf_birth_weight_kg numeric(6, 2),
  retained_placenta boolean not null default false,
  notes text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists calvings_dam_date_idx on public.calvings(dam_animal_id, calving_date);

-- ---------- health_events ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'health_event_type') then
    create type health_event_type as enum ('diagnosis', 'treatment', 'vaccination', 'hoof_trim');
  end if;
end$$;

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  event_date date not null,
  event_type health_event_type not null,
  diagnosis_code text references public.diagnoses_catalog(code) on delete set null,
  diagnosis_text text,
  severity int,
  quarter text,
  drug_name text,
  drug_dose_amount numeric(10, 3),
  drug_dose_unit text,
  route_code text references public.routes_catalog(code) on delete set null,
  withdrawal_milk_end timestamptz,
  withdrawal_meat_end date,
  prescribing_vet text,
  locomotion_score int,
  notes text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists health_events_animal_date_idx
  on public.health_events(animal_id, event_date desc);

-- ---------- genomics ----------
create table if not exists public.genomics (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  test_date date not null,
  lab text,
  chip text,
  gtpi int,
  nm_dollar int,
  cm_dollar int,
  fm_dollar int,
  gm_dollar int,
  pta_milk int,
  pta_fat int,
  pta_protein int,
  pta_fat_pct numeric(5, 2),
  pta_protein_pct numeric(5, 2),
  pta_pl numeric(5, 2),
  pta_scs numeric(5, 2),
  pta_dpr numeric(5, 2),
  pta_ccr numeric(5, 2),
  pta_hcr numeric(5, 2),
  pta_livability numeric(5, 2),
  pta_feed_eff numeric(8, 2),
  pta_type numeric(5, 2),
  udder_composite numeric(5, 2),
  feet_legs_composite numeric(5, 2),
  body_size_composite numeric(5, 2),
  reliability_milk int,
  hh1 text, hh2 text, hh3 text, hh4 text, hh5 text, hh6 text,
  hhb text, hhc text, hhd text,
  jh1 text, jh2 text,
  bh1 text, bh2 text,
  polled_genotype text,
  kappa_casein text,
  beta_casein text,
  recessives_other text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now(),
  unique (animal_id, test_date)
);

-- ---------- scores (BCS / locomotion / weight / conformation) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'score_type') then
    create type score_type as enum ('bcs', 'locomotion', 'weight', 'conformation');
  end if;
end$$;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  score_date date not null,
  score_type score_type not null,
  score_value numeric(8, 2) not null,
  scale text,
  scorer text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists scores_animal_idx on public.scores(animal_id, score_date desc);

-- ---------- pen_moves ----------
create table if not exists public.pen_moves (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  move_date date not null,
  from_pen_id uuid references public.pens(id) on delete set null,
  to_pen_id uuid references public.pens(id) on delete set null,
  reason text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists pen_moves_animal_date_idx
  on public.pen_moves(animal_id, move_date desc);

-- ---------- transactions (entries / exits / financial) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type transaction_type as enum (
      'purchase', 'sale', 'death', 'euthanasia',
      'cull_dairy', 'cull_beef', 'transfer_in', 'transfer_out'
    );
  end if;
end$$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  txn_date date not null,
  txn_type transaction_type not null,
  price numeric(12, 2),
  currency text,
  counterparty text,
  primary_cull_reason text references public.cull_reasons_catalog(code) on delete set null,
  secondary_cull_reason text references public.cull_reasons_catalog(code) on delete set null,
  death_method text,
  carcass_weight_kg numeric(8, 2),
  notes text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists transactions_animal_date_idx
  on public.transactions(animal_id, txn_date desc);

-- ---------- bulk_tank_readings ----------
create table if not exists public.bulk_tank_readings (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  reading_date date not null,
  volume_kg numeric(12, 2),
  volume_l numeric(12, 2),
  fat_pct numeric(5, 2),
  protein_pct numeric(5, 2),
  scc int,
  temperature_c numeric(5, 2),
  source event_source not null default 'manual',
  source_external_id text,
  notes text,
  created_at timestamptz not null default now(),
  unique (location_id, reading_date)
);
create index if not exists bulk_tank_readings_loc_idx
  on public.bulk_tank_readings(location_id, reading_date desc);

-- ---------- milk_diversions ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'milk_diversion_bucket') then
    create type milk_diversion_bucket as enum (
      'hospital', 'calves', 'waste', 'dumped', 'spilled', 'other'
    );
  end if;
end$$;

create table if not exists public.milk_diversions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  diversion_date date not null,
  kg numeric(10, 2) not null,
  bucket milk_diversion_bucket not null,
  notes text,
  source event_source not null default 'manual',
  source_external_id text,
  created_at timestamptz not null default now()
);
create index if not exists milk_diversions_loc_date_idx
  on public.milk_diversions(location_id, diversion_date desc);

-- ---------- RLS for all event tables ----------
-- All animal-linked tables share the same auth pattern: super_admin sees
-- everything; org members see rows whose animal belongs to a location
-- inside their org; only admin can write.

do $$
declare
  t text;
  animal_tables text[] := array[
    'animals', 'lactations', 'test_days', 'milkings', 'repro_events',
    'calvings', 'health_events', 'genomics', 'scores', 'pen_moves',
    'transactions'
  ];
  location_tables text[] := array[
    'bulk_tank_readings', 'milk_diversions'
  ];
begin
  foreach t in array animal_tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array location_tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end$$;

-- Build select / write policies. For tables that reference an animal,
-- we join through animals → locations → organization. For tables that
-- directly reference a location, we check location → organization.

-- animals: direct location_id
drop policy if exists animals_select on public.animals;
create policy animals_select on public.animals for select using (
  public.auth_role() = 'super_admin'
  or exists (select 1 from public.locations l where l.id = location_id and l.organization_id = public.auth_org_id())
);
drop policy if exists animals_write on public.animals;
create policy animals_write on public.animals for all using (
  public.auth_role() = 'super_admin'
  or exists (select 1 from public.locations l where l.id = location_id and l.organization_id = public.auth_org_id() and public.auth_role() = 'admin')
) with check (
  public.auth_role() = 'super_admin'
  or exists (select 1 from public.locations l where l.id = location_id and l.organization_id = public.auth_org_id() and public.auth_role() = 'admin')
);

-- Per-animal tables: select via animal → location → org
do $$
declare
  t text;
  animal_tables text[] := array[
    'lactations', 'test_days', 'repro_events', 'calvings',
    'health_events', 'genomics', 'scores', 'pen_moves', 'transactions'
  ];
  animal_fk text;
begin
  foreach t in array animal_tables loop
    -- All these tables use `animal_id` column except calvings which uses dam_animal_id
    if t = 'calvings' then
      animal_fk := 'dam_animal_id';
    else
      animal_fk := 'animal_id';
    end if;

    execute format($f$
      drop policy if exists %1$s_select on public.%1$s;
      create policy %1$s_select on public.%1$s for select using (
        public.auth_role() = 'super_admin'
        or exists (
          select 1 from public.animals a
          join public.locations l on l.id = a.location_id
          where a.id = %1$s.%2$s
            and l.organization_id = public.auth_org_id()
        )
      );
      drop policy if exists %1$s_write on public.%1$s;
      create policy %1$s_write on public.%1$s for all using (
        public.auth_role() = 'super_admin'
        or exists (
          select 1 from public.animals a
          join public.locations l on l.id = a.location_id
          where a.id = %1$s.%2$s
            and l.organization_id = public.auth_org_id()
            and public.auth_role() = 'admin'
        )
      ) with check (
        public.auth_role() = 'super_admin'
        or exists (
          select 1 from public.animals a
          join public.locations l on l.id = a.location_id
          where a.id = %1$s.%2$s
            and l.organization_id = public.auth_org_id()
            and public.auth_role() = 'admin'
        )
      );
    $f$, t, animal_fk);
  end loop;
end$$;

-- milkings has both animal_id AND location_id; we keep the animal-based
-- check (animal must belong to the org's location).
drop policy if exists milkings_select on public.milkings;
create policy milkings_select on public.milkings for select using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.animals a
    join public.locations l on l.id = a.location_id
    where a.id = milkings.animal_id
      and l.organization_id = public.auth_org_id()
  )
);
drop policy if exists milkings_write on public.milkings;
create policy milkings_write on public.milkings for all using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.animals a
    join public.locations l on l.id = a.location_id
    where a.id = milkings.animal_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
) with check (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.animals a
    join public.locations l on l.id = a.location_id
    where a.id = milkings.animal_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
);

-- Location-linked tables: direct check
do $$
declare
  t text;
  loc_tables text[] := array['bulk_tank_readings', 'milk_diversions'];
begin
  foreach t in array loc_tables loop
    execute format($f$
      drop policy if exists %1$s_select on public.%1$s;
      create policy %1$s_select on public.%1$s for select using (
        public.auth_role() = 'super_admin'
        or exists (select 1 from public.locations l where l.id = %1$s.location_id and l.organization_id = public.auth_org_id())
      );
      drop policy if exists %1$s_write on public.%1$s;
      create policy %1$s_write on public.%1$s for all using (
        public.auth_role() = 'super_admin'
        or exists (select 1 from public.locations l where l.id = %1$s.location_id and l.organization_id = public.auth_org_id() and public.auth_role() = 'admin')
      ) with check (
        public.auth_role() = 'super_admin'
        or exists (select 1 from public.locations l where l.id = %1$s.location_id and l.organization_id = public.auth_org_id() and public.auth_role() = 'admin')
      );
    $f$, t);
  end loop;
end$$;


-- ------------------------------------------------------------------
-- File: 0013_milk_pricing.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0013 — Milk pricing schemes (per location, effective-dated)
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'correction_method') then
    create type correction_method as enum (
      'raw', 'fcm_3.5', 'fcm_4', 'ecm_nrc', 'ecm_tr',
      'ms', 'ts', 'fat_corrected', 'snf_corrected', 'custom'
    );
  end if;
end$$;

create table if not exists public.milk_pricing_schemes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  template_id uuid references public.org_pricing_scheme_templates(id) on delete set null,
  name text not null,
  currency text not null,
  base_unit text not null,
  correction correction_method not null default 'raw',
  base_price_per_unit numeric(12, 4),
  component_bonuses jsonb not null default '{}'::jsonb,
  scc_tiers jsonb not null default '[]'::jsonb,
  volume_tiers jsonb not null default '[]'::jsonb,
  quality_bonus_flat numeric(10, 4),
  effective_from date not null,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists milk_pricing_schemes_loc_dates_idx
  on public.milk_pricing_schemes(location_id, effective_from desc);

drop trigger if exists milk_pricing_schemes_set_updated_at on public.milk_pricing_schemes;
create trigger milk_pricing_schemes_set_updated_at
  before update on public.milk_pricing_schemes
  for each row execute function public.set_updated_at();

alter table public.milk_pricing_schemes enable row level security;

drop policy if exists milk_pricing_schemes_select on public.milk_pricing_schemes;
create policy milk_pricing_schemes_select on public.milk_pricing_schemes for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists milk_pricing_schemes_write on public.milk_pricing_schemes;
create policy milk_pricing_schemes_write on public.milk_pricing_schemes for all
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

-- Helper: close any open scheme when a new one starts. Idempotent.
create or replace function public.close_overlapping_pricing_schemes()
returns trigger language plpgsql security definer as $$
begin
  update public.milk_pricing_schemes
     set effective_to = new.effective_from - interval '1 day',
         updated_at = now()
   where location_id = new.location_id
     and id <> new.id
     and effective_to is null
     and effective_from < new.effective_from;
  return new;
end$$;

drop trigger if exists milk_pricing_schemes_close_prev on public.milk_pricing_schemes;
create trigger milk_pricing_schemes_close_prev
  after insert on public.milk_pricing_schemes
  for each row execute function public.close_overlapping_pricing_schemes();


-- ------------------------------------------------------------------
-- File: 0014_crop_plans.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0014 — Crop plans + crop events on arable parcels
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crop_plan_status') then
    create type crop_plan_status as enum ('planned', 'in_progress', 'harvested', 'failed', 'archived');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crop_event_type') then
    create type crop_event_type as enum (
      'planting', 'irrigation', 'fertilization', 'spray',
      'scouting', 'harvest', 'residue_management', 'other'
    );
  end if;
end$$;

create table if not exists public.crop_plans (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references public.arable_parcels(id) on delete cascade,
  crop_type text not null,
  variety text,
  planted_at date,
  planned_harvest_at date,
  status crop_plan_status not null default 'planned',
  expected_yield_kg_per_ha numeric(10, 1),
  actual_yield_kg_per_ha numeric(10, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crop_plans_parcel_idx on public.crop_plans(parcel_id);

drop trigger if exists crop_plans_set_updated_at on public.crop_plans;
create trigger crop_plans_set_updated_at
  before update on public.crop_plans
  for each row execute function public.set_updated_at();

create table if not exists public.crop_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.crop_plans(id) on delete cascade,
  event_date date not null,
  event_type crop_event_type not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crop_events_plan_date_idx
  on public.crop_events(plan_id, event_date desc);

alter table public.crop_plans enable row level security;
alter table public.crop_events enable row level security;

drop policy if exists crop_plans_select on public.crop_plans;
create policy crop_plans_select on public.crop_plans for select using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.arable_parcels p
    join public.locations l on l.id = p.location_id
    where p.id = parcel_id and l.organization_id = public.auth_org_id()
  )
);
drop policy if exists crop_plans_write on public.crop_plans;
create policy crop_plans_write on public.crop_plans for all using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.arable_parcels p
    join public.locations l on l.id = p.location_id
    where p.id = parcel_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
) with check (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.arable_parcels p
    join public.locations l on l.id = p.location_id
    where p.id = parcel_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
);

drop policy if exists crop_events_select on public.crop_events;
create policy crop_events_select on public.crop_events for select using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.crop_plans cp
    join public.arable_parcels p on p.id = cp.parcel_id
    join public.locations l on l.id = p.location_id
    where cp.id = plan_id and l.organization_id = public.auth_org_id()
  )
);
drop policy if exists crop_events_write on public.crop_events;
create policy crop_events_write on public.crop_events for all using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.crop_plans cp
    join public.arable_parcels p on p.id = cp.parcel_id
    join public.locations l on l.id = p.location_id
    where cp.id = plan_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
) with check (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.crop_plans cp
    join public.arable_parcels p on p.id = cp.parcel_id
    join public.locations l on l.id = p.location_id
    where cp.id = plan_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
);


-- ------------------------------------------------------------------
-- File: 0015_location_access_matrix.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0015 — Location user access with per-section permission matrix
-- =====================================================================
-- Supersedes the flat location_members table from 0003. A user can be
-- granted "view" or "edit" per Settings section on a per-location
-- basis. Admin role on the org still implies full access.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'access_level') then
    create type access_level as enum ('none', 'view', 'edit');
  end if;
end$$;

create table if not exists public.location_user_access (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Default access level applied when no per-section row overrides
  default_access access_level not null default 'view',
  -- Optional per-section overrides as jsonb: { recording: 'edit', groups: 'view', ... }
  section_access jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, user_id)
);

create index if not exists location_user_access_user_idx
  on public.location_user_access(user_id);

drop trigger if exists location_user_access_set_updated_at on public.location_user_access;
create trigger location_user_access_set_updated_at
  before update on public.location_user_access
  for each row execute function public.set_updated_at();

alter table public.location_user_access enable row level security;

drop policy if exists location_user_access_select on public.location_user_access;
create policy location_user_access_select on public.location_user_access for select
  using (
    public.auth_role() = 'super_admin'
    or user_id = auth.uid()
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  );

drop policy if exists location_user_access_write on public.location_user_access;
create policy location_user_access_write on public.location_user_access for all
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


-- ------------------------------------------------------------------
-- File: 0016_directories.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0016 — Per-location people directories
-- =====================================================================
-- Technicians, veterinarians, hoof trimmers, nutritionists, and other
-- people referenced by events at this location. Future events
-- (repro_events.technician, health_events.prescribing_vet, etc.) can
-- optionally FK into this table; for now it's a freestanding directory.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'directory_role') then
    create type directory_role as enum (
      'technician', 'veterinarian', 'hoof_trimmer', 'nutritionist',
      'inseminator', 'consultant', 'other'
    );
  end if;
end$$;

create table if not exists public.location_directory (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  role directory_role not null,
  full_name text not null,
  organization_name text,
  email text,
  phone text,
  external_id text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists location_directory_loc_role_idx
  on public.location_directory(location_id, role);

drop trigger if exists location_directory_set_updated_at on public.location_directory;
create trigger location_directory_set_updated_at
  before update on public.location_directory
  for each row execute function public.set_updated_at();

alter table public.location_directory enable row level security;

drop policy if exists location_directory_select on public.location_directory;
create policy location_directory_select on public.location_directory for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists location_directory_write on public.location_directory;
create policy location_directory_write on public.location_directory for all
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


-- ------------------------------------------------------------------
-- File: 0017_pakistan_defaults_land_units.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0017 — Pakistan-centric defaults + granular land area unit
-- =====================================================================
-- - Adds `land_area_unit` enum and corresponding org default + location
--   override columns.
-- - Switches the DB defaults on organizations (currency/timezone/land
--   unit) to Pakistan-appropriate values so new orgs land sensibly.
-- - Existing rows are left untouched (admins update via the form).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'land_area_unit') then
    create type land_area_unit as enum (
      'hectare',
      'acre',
      'square_meter',
      'square_foot',
      'marla',
      'kanal',
      'murabba'
    );
  end if;
end$$;

alter table public.organizations
  add column if not exists default_land_area_unit land_area_unit not null default 'acre';

alter table public.locations
  add column if not exists land_area_unit_override land_area_unit;

-- New-row defaults (existing rows keep their values)
alter table public.organizations
  alter column default_currency set default 'PKR';
alter table public.organizations
  alter column default_timezone set default 'Asia/Karachi';


-- ------------------------------------------------------------------
-- File: 0018_dairy_operational_settings.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0018 — Per-location dairy operational settings
-- =====================================================================
-- Industry-standard dairy operational config. One row
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

