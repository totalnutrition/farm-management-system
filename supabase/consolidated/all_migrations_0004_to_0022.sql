-- =====================================================================
-- FarmInsight consolidated migration (0004 → 0022)
-- =====================================================================
-- Apply this single file in the Supabase SQL editor to bring a
-- database from the post-PR #9 state (migrations 0001-0003 applied)
-- up to current master. All statements are idempotent.
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


-- ------------------------------------------------------------------
-- File: 0019_org_catalogs_v2.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0019 — Organizational catalogs for dairy operations
-- =====================================================================
-- Seeded reference data that every organization gets by default:
--   - Reproduction sync protocols (OvSynch, Presynch-Ovsynch, etc.)
--   - Vaccination protocols (adult / pre-breeding / calf / dry-off)
--   - Treatment protocols (per common diagnosis)
--   - Feed materials catalog (corn silage, alfalfa, grains, byproducts,
--     minerals, vitamins)
--   - Veterinary medicine catalog
--   - Suppliers + buyers (per-location)
--
-- Seed rows have organization_id = NULL (visible to all). Orgs can
-- clone seeds with their own organization_id and edit freely.

-- ---------------------------------------------------------------------
-- Reproduction protocols (sync / resync / fixed-time AI)
-- ---------------------------------------------------------------------
create table if not exists public.org_repro_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  protocol_type text not null,                  -- 'sync' / 'resync' / 'fixed-time-AI' / 'manual'
  steps jsonb not null default '[]'::jsonb,     -- [{day, action, dose, route}]
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create unique index if not exists org_repro_protocols_seed_slug_idx
  on public.org_repro_protocols(slug) where organization_id is null;

alter table public.org_repro_protocols enable row level security;
drop policy if exists org_repro_protocols_select on public.org_repro_protocols;
create policy org_repro_protocols_select on public.org_repro_protocols for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_repro_protocols_write on public.org_repro_protocols;
create policy org_repro_protocols_write on public.org_repro_protocols for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_repro_protocols (organization_id, slug, name, description, protocol_type, steps, is_seed) values
  (null, 'ovsynch', 'OvSynch', 'Standard timed-AI synchronization. 10 days, 2 GnRH + 1 PGF + AI.', 'fixed-time-AI',
    '[{"day":0,"action":"GnRH","dose":"100 mcg","route":"IM"},{"day":7,"action":"PGF2a","dose":"25 mg dinoprost / 500 mcg cloprostenol","route":"IM"},{"day":9,"action":"GnRH","dose":"100 mcg","route":"IM"},{"day":10,"action":"AI","note":"16-24 h after 2nd GnRH"}]'::jsonb,
    true),
  (null, 'presynch-ovsynch', 'Presynch-Ovsynch', '14-day Presynch + Ovsynch. Two PGF doses 14 days apart, then Ovsynch 14 days later.', 'fixed-time-AI',
    '[{"day":-28,"action":"PGF2a"},{"day":-14,"action":"PGF2a"},{"day":0,"action":"GnRH"},{"day":7,"action":"PGF2a"},{"day":9,"action":"GnRH"},{"day":10,"action":"AI"}]'::jsonb,
    true),
  (null, 'double-ovsynch', 'Double-Ovsynch', 'Two Ovsynch cycles back-to-back to improve first-service preg rate.', 'fixed-time-AI',
    '[{"day":-10,"action":"GnRH"},{"day":-3,"action":"PGF2a"},{"day":0,"action":"GnRH"},{"day":7,"action":"PGF2a"},{"day":9,"action":"GnRH"},{"day":10,"action":"AI"}]'::jsonb,
    true),
  (null, 'g6g', 'G6G', 'GnRH 6-7 days before Ovsynch start. Improves response in early-postpartum cows.', 'fixed-time-AI',
    '[{"day":-7,"action":"GnRH"},{"day":0,"action":"GnRH"},{"day":7,"action":"PGF2a"},{"day":9,"action":"GnRH"},{"day":10,"action":"AI"}]'::jsonb,
    true),
  (null, 'cidr-sync', 'CIDR-Sync (Ovsynch + CIDR)', 'Ovsynch protocol plus a CIDR insert for 7 days. Good for anoestrus cows.', 'fixed-time-AI',
    '[{"day":0,"action":"GnRH + insert CIDR"},{"day":7,"action":"Remove CIDR + PGF2a"},{"day":9,"action":"GnRH"},{"day":10,"action":"AI"}]'::jsonb,
    true),
  (null, 'resynch', 'Resynch (open at preg check)', 'Re-synchronize cows found open at preg check.', 'resync',
    '[{"day":32,"action":"GnRH","note":"If open at preg check"},{"day":39,"action":"PGF2a"},{"day":41,"action":"GnRH"},{"day":42,"action":"AI"}]'::jsonb,
    true)
on conflict (slug) where organization_id is null do update set
  name = excluded.name, description = excluded.description,
  protocol_type = excluded.protocol_type, steps = excluded.steps;

-- ---------------------------------------------------------------------
-- Vaccination protocols
-- ---------------------------------------------------------------------
create table if not exists public.org_vaccination_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  target_class text not null,                   -- 'lactating' / 'dry' / 'heifer' / 'calf' / 'bull'
  schedule jsonb not null default '[]'::jsonb,  -- [{at, basis, vaccine, dose, route}]
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create unique index if not exists org_vax_protocols_seed_slug_idx
  on public.org_vaccination_protocols(slug) where organization_id is null;

alter table public.org_vaccination_protocols enable row level security;
drop policy if exists org_vax_protocols_select on public.org_vaccination_protocols;
create policy org_vax_protocols_select on public.org_vaccination_protocols for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_vax_protocols_write on public.org_vaccination_protocols;
create policy org_vax_protocols_write on public.org_vaccination_protocols for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_vaccination_protocols (organization_id, slug, name, target_class, schedule, is_seed, description) values
  (null, 'adult-annual', 'Adult cow annual', 'lactating',
    '[{"basis":"annual","at":"yearly","vaccine":"BVD/IBR/BRSV/PI3 + Lepto5 + Vibrio","route":"SC"}]'::jsonb,
    true, 'Annual core vaccinations for milking and dry cows.'),
  (null, 'pre-breeding-heifer', 'Pre-breeding heifer', 'heifer',
    '[{"basis":"days_before_breeding","at":-45,"vaccine":"BVD/IBR/BRSV/PI3 + Lepto5 + Vibrio","route":"SC"},{"basis":"days_before_breeding","at":-14,"vaccine":"Booster","route":"SC"}]'::jsonb,
    true, '4-6 weeks before first breeding plus booster 2 weeks later.'),
  (null, 'calf-series', 'Calf series (BRD prevention)', 'calf',
    '[{"basis":"age_days","at":30,"vaccine":"BVD/IBR/BRSV/PI3 (modified-live or killed)","route":"SC"},{"basis":"age_days","at":60,"vaccine":"Booster","route":"SC"},{"basis":"age_days","at":90,"vaccine":"Clostridial 7-way","route":"SC"}]'::jsonb,
    true, 'Respiratory disease prevention plus clostridial.'),
  (null, 'dry-off-mastitis', 'Dry-off mastitis prevention (J5)', 'dry',
    '[{"basis":"days_relative_to_dry_off","at":-60,"vaccine":"J5 (E. coli core antigen)","route":"SC"},{"basis":"days_relative_to_dry_off","at":-30,"vaccine":"J5 booster","route":"SC"},{"basis":"days_after_calving","at":1,"vaccine":"J5 booster","route":"SC"}]'::jsonb,
    true, 'J5 E. coli vaccine series to reduce clinical mastitis.')
on conflict (slug) where organization_id is null do update set
  name = excluded.name, target_class = excluded.target_class,
  schedule = excluded.schedule, description = excluded.description;

-- ---------------------------------------------------------------------
-- Treatment protocols (per common diagnosis)
-- ---------------------------------------------------------------------
create table if not exists public.org_treatment_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  diagnosis_code text references public.diagnoses_catalog(code) on delete set null,
  description text,
  steps jsonb not null default '[]'::jsonb,     -- [{drug, dose, route, frequency, duration_days, withdrawal_milk_h, withdrawal_meat_d}]
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create unique index if not exists org_tx_protocols_seed_slug_idx
  on public.org_treatment_protocols(slug) where organization_id is null;

alter table public.org_treatment_protocols enable row level security;
drop policy if exists org_tx_protocols_select on public.org_treatment_protocols;
create policy org_tx_protocols_select on public.org_treatment_protocols for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_tx_protocols_write on public.org_treatment_protocols;
create policy org_tx_protocols_write on public.org_treatment_protocols for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_treatment_protocols (organization_id, slug, name, diagnosis_code, description, steps, is_seed) values
  (null, 'mastitis-pirsue', 'Clinical mastitis — Pirsue (pirlimycin) IMM', 'MAST-CM',
    'Standard IMM treatment for clinical mastitis caused by gram-positive pathogens.',
    '[{"drug":"Pirsue","active":"pirlimycin","dose":"50 mg","route":"IMM","frequency":"once daily","duration_days":8,"withdrawal_milk_h":36,"withdrawal_meat_d":9}]'::jsonb,
    true),
  (null, 'mastitis-spectramast-lc', 'Clinical mastitis — Spectramast LC (ceftiofur) IMM', 'MAST-CM',
    'Broad-spectrum IMM treatment for clinical mastitis.',
    '[{"drug":"Spectramast LC","active":"ceftiofur HCl","dose":"125 mg","route":"IMM","frequency":"once daily","duration_days":5,"withdrawal_milk_h":72,"withdrawal_meat_d":2}]'::jsonb,
    true),
  (null, 'metritis-excede', 'Metritis — Excede (ceftiofur CFA) SC', 'MET',
    'Single-dose ceftiofur for fresh-cow metritis.',
    '[{"drug":"Excede","active":"ceftiofur CFA","dose":"1.5 mg/lb","route":"SC (base of ear)","frequency":"once","duration_days":1,"withdrawal_milk_h":0,"withdrawal_meat_d":13}]'::jsonb,
    true),
  (null, 'ketosis-dex-propylene', 'Ketosis — Dexamethasone + Propylene glycol', 'KET',
    'Standard combination for subclinical/clinical ketosis.',
    '[{"drug":"Dexamethasone","dose":"20 mg","route":"IM","frequency":"once","duration_days":1},{"drug":"Propylene glycol","dose":"300 mL","route":"PO","frequency":"once daily","duration_days":3}]'::jsonb,
    true),
  (null, 'milk-fever-cmpk', 'Milk fever — CMPK IV', 'MF',
    'Slow IV calcium for hypocalcemic cows.',
    '[{"drug":"CMPK 500 mL","dose":"500 mL","route":"IV","note":"give slowly over 10-15 minutes, monitor heart","frequency":"once","duration_days":1},{"drug":"Bovikalc","dose":"1-2 boluses","route":"PO","frequency":"once","duration_days":1}]'::jsonb,
    true),
  (null, 'rp-excenel', 'Retained placenta — Excenel IM', 'RP',
    'Ceftiofur IM for retained placenta when systemic illness present.',
    '[{"drug":"Excenel","active":"ceftiofur HCl","dose":"1.1 mg/lb","route":"IM/SC","frequency":"once daily","duration_days":5,"withdrawal_milk_h":0,"withdrawal_meat_d":4}]'::jsonb,
    true)
on conflict (slug) where organization_id is null do update set
  name = excluded.name, diagnosis_code = excluded.diagnosis_code,
  description = excluded.description, steps = excluded.steps;

-- ---------------------------------------------------------------------
-- Feed materials catalog (organization-level, seeded)
-- ---------------------------------------------------------------------
create table if not exists public.org_feed_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  category text not null,                       -- 'forage' / 'grain' / 'protein' / 'byproduct' / 'mineral' / 'vitamin' / 'water' / 'fat' / 'additive'
  dm_pct numeric(5, 2),
  ne_l_mcal_per_kg numeric(6, 3),
  cp_pct numeric(5, 2),
  ndf_pct numeric(5, 2),
  starch_pct numeric(5, 2),
  notes text,
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.org_feed_materials enable row level security;
drop policy if exists org_feed_materials_select on public.org_feed_materials;
create policy org_feed_materials_select on public.org_feed_materials for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_feed_materials_write on public.org_feed_materials;
create policy org_feed_materials_write on public.org_feed_materials for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_feed_materials (organization_id, name, category, dm_pct, ne_l_mcal_per_kg, cp_pct, ndf_pct, starch_pct, is_seed) values
  (null, 'Corn silage',            'forage',    32.00, 1.55,  8.00, 45.00, 28.00, true),
  (null, 'Alfalfa hay',             'forage',    88.00, 1.25, 18.00, 41.00,  2.00, true),
  (null, 'Alfalfa haylage',         'forage',    40.00, 1.25, 18.00, 42.00,  2.00, true),
  (null, 'Grass hay',               'forage',    88.00, 1.10, 12.00, 60.00,  1.00, true),
  (null, 'Wheat straw',             'forage',    89.00, 0.90,  4.00, 80.00,  1.00, true),
  (null, 'Corn grain — ground',     'grain',     88.00, 2.04,  9.00,  9.00, 70.00, true),
  (null, 'Corn grain — steam-flaked','grain',     85.00, 2.10,  9.00,  9.00, 72.00, true),
  (null, 'Soybean meal — 48%',      'protein',   89.00, 1.94, 48.00, 10.00,  3.00, true),
  (null, 'Cottonseed — whole',      'protein',   90.00, 2.00, 24.00, 50.00,  0.00, true),
  (null, 'Distillers grains (DDGS)','byproduct', 90.00, 1.92, 30.00, 40.00,  4.00, true),
  (null, 'Beet pulp — pelleted',    'byproduct', 89.00, 1.60,  9.00, 50.00,  1.00, true),
  (null, 'Bypass fat',              'fat',       99.00, 5.50,  0.00,  0.00,  0.00, true),
  (null, 'Sodium bicarbonate',      'mineral',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Limestone (CaCO3)',       'mineral',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Salt (NaCl)',             'mineral',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Magnesium oxide',         'mineral',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Trace mineral salt',      'mineral',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Vitamin ADE premix',      'vitamin',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Selenium yeast',          'mineral',  100.00, 0.00,  0.00,  0.00,  0.00, true),
  (null, 'Urea 46%',                'protein',  100.00, 0.00,281.00,  0.00,  0.00, true)
on conflict (organization_id, name) do nothing;

-- ---------------------------------------------------------------------
-- Veterinary medicines catalog
-- ---------------------------------------------------------------------
create table if not exists public.org_vet_medicines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  brand text,
  active_ingredient text,
  category text not null,                       -- 'antibiotic' / 'anti-inflammatory' / 'hormone' / 'vaccine' / 'parasiticide' / 'mineral' / 'fluid' / 'other'
  route text,                                   -- 'IM' / 'IV' / 'SC' / 'IMM' / 'PO' / 'Topical' / 'IU'
  default_dose text,
  withdrawal_milk_hours int,
  withdrawal_meat_days int,
  notes text,
  is_seed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.org_vet_medicines enable row level security;
drop policy if exists org_vet_medicines_select on public.org_vet_medicines;
create policy org_vet_medicines_select on public.org_vet_medicines for select
  using (
    organization_id is null
    or public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );
drop policy if exists org_vet_medicines_write on public.org_vet_medicines;
create policy org_vet_medicines_write on public.org_vet_medicines for all
  using (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  )
  with check (
    public.auth_role() = 'super_admin'
    or (public.auth_role() = 'admin' and organization_id = public.auth_org_id())
  );

insert into public.org_vet_medicines (organization_id, name, brand, active_ingredient, category, route, default_dose, withdrawal_milk_hours, withdrawal_meat_days, is_seed) values
  (null, 'Pirsue',                'Zoetis',         'Pirlimycin HCl',         'antibiotic',         'IMM',      '50 mg per quarter', 36, 9,  true),
  (null, 'Spectramast LC',        'Zoetis',         'Ceftiofur HCl',          'antibiotic',         'IMM',      '125 mg per quarter', 72, 2, true),
  (null, 'Spectramast DC',        'Zoetis',         'Ceftiofur HCl (dry)',    'antibiotic',         'IMM',      '500 mg per quarter at dry-off', 0, 16, true),
  (null, 'Excede',                'Zoetis',         'Ceftiofur CFA',          'antibiotic',         'SC',       '1.5 mg/lb base of ear', 0, 13, true),
  (null, 'Excenel',               'Zoetis',         'Ceftiofur HCl',          'antibiotic',         'IM/SC',    '1.1 mg/lb', 0, 4, true),
  (null, 'Banamine',              'Merck',          'Flunixin meglumine',     'anti-inflammatory',  'IV/IM',    '1.1 mg/lb', 36, 4, true),
  (null, 'Dexamethasone',         'Multiple',       'Dexamethasone',          'anti-inflammatory',  'IV/IM',    '20 mg', 72, 4, true),
  (null, 'Lutalyse',              'Zoetis',         'Dinoprost tromethamine', 'hormone',            'IM',       '25 mg', 0, 0, true),
  (null, 'Estrumate',             'Merck',          'Cloprostenol sodium',    'hormone',            'IM',       '500 mcg', 0, 0, true),
  (null, 'Cystorelin',            'Merial',         'Gonadorelin (GnRH)',     'hormone',            'IM',       '100 mcg', 0, 0, true),
  (null, 'Factrel',               'Zoetis',         'Gonadorelin (GnRH)',     'hormone',            'IM',       '100 mcg', 0, 0, true),
  (null, 'Oxytocin',              'Multiple',       'Oxytocin',               'hormone',            'IV/IM',    '20-40 IU', 0, 0, true),
  (null, 'Bovikalc',              'Boehringer',     'Calcium chloride bolus', 'mineral',            'PO',       '1-2 boluses', 0, 0, true),
  (null, 'CMPK 500 mL',           'Multiple',       'Ca/Mg/P/K solution',     'fluid',              'IV',       '500 mL slow', 0, 0, true),
  (null, 'Bovi-Shield Gold FP5 VL5','Zoetis',       'BVD/IBR/BRSV/PI3 + Lepto5 + Vibrio', 'vaccine','SC',       '2 mL annual', 0, 21, true),
  (null, 'J-Vac / J-5',           'Merck',          'E. coli J5 core antigen','vaccine',            'SC',       '5 mL', 0, 0, true),
  (null, 'Vision 7 / Tasvax 8',   'Multiple',       'Clostridial 7-8 way',    'vaccine',            'SC',       '2 mL', 0, 21, true),
  (null, 'Ivermectin 1%',         'Multiple',       'Ivermectin',             'parasiticide',       'SC',       '1 mL / 50 kg', 0, 35, true),
  (null, 'Propylene glycol',      'Multiple',       'Propylene glycol',       'other',              'PO',       '300 mL daily', 0, 0, true)
on conflict (organization_id, name) do nothing;

-- ---------------------------------------------------------------------
-- Suppliers and buyers (per-location directories)
-- ---------------------------------------------------------------------
create table if not exists public.location_suppliers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  category text,                                -- 'feed' / 'vet' / 'semen' / 'equipment' / 'forage' / 'service' / 'other'
  contact_email text,
  contact_phone text,
  address text,
  payment_terms text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

drop trigger if exists location_suppliers_set_updated_at on public.location_suppliers;
create trigger location_suppliers_set_updated_at
  before update on public.location_suppliers
  for each row execute function public.set_updated_at();

alter table public.location_suppliers enable row level security;
drop policy if exists location_suppliers_select on public.location_suppliers;
create policy location_suppliers_select on public.location_suppliers for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists location_suppliers_write on public.location_suppliers;
create policy location_suppliers_write on public.location_suppliers for all
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

create table if not exists public.location_buyers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  category text,                                -- 'milk' / 'cull-dairy' / 'cull-beef' / 'heifer' / 'calf' / 'manure' / 'other'
  contact_email text,
  contact_phone text,
  address text,
  default_pricing_scheme_id uuid references public.milk_pricing_schemes(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

drop trigger if exists location_buyers_set_updated_at on public.location_buyers;
create trigger location_buyers_set_updated_at
  before update on public.location_buyers
  for each row execute function public.set_updated_at();

alter table public.location_buyers enable row level security;
drop policy if exists location_buyers_select on public.location_buyers;
create policy location_buyers_select on public.location_buyers for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists location_buyers_write on public.location_buyers;
create policy location_buyers_write on public.location_buyers for all
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
-- File: 0020_animal_life_stage.sql
-- ------------------------------------------------------------------

-- =====================================================================
-- 0020 — Animal life stage (DC305-style classification)
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'animal_life_stage') then
    create type animal_life_stage as enum (
      'calf',             -- 0-6 months pre-weaning / pre-breeding
      'weaned_heifer',    -- weaned, 2-6 months
      'breeding_heifer',  -- 6+ months eligible to breed, open
      'bred_heifer',      -- pregnant, never lactated
      'lactating',        -- currently milking
      'dry',              -- parity >= 1, dried off
      'bull',
      'other'
    );
  end if;
end $$;

alter table public.animals
  add column if not exists life_stage animal_life_stage not null default 'other';

-- Backfill existing rows with a reasonable heuristic. Only touches rows
-- still at the default ('other') so re-running is safe.
update public.animals
   set life_stage = case
     when sex = 'male' then 'bull'::animal_life_stage
     when current_lactation is not null and current_lactation > 0 and last_calving_date is not null
       then 'lactating'::animal_life_stage
     when current_lactation is not null and current_lactation > 0 and last_calving_date is null
       then 'dry'::animal_life_stage
     when sex = 'female' and (current_lactation is null or current_lactation = 0)
       then 'breeding_heifer'::animal_life_stage
     else 'other'::animal_life_stage
   end
 where life_stage = 'other';


-- ------------------------------------------------------------------
-- File: 0021_inventory_hr_events.sql
-- ------------------------------------------------------------------

-- ===================================================================
-- 0021_inventory_hr_events.sql
-- Stock ledger + per-domain event tables + HR (workers/attendance/payroll).
--
-- Adds the plumbing that lets operational events deduct inventory:
--   feeding event  →  stock_movements (kind=consumption) against feed line
--   vaccination    →  stock_movements against vet medicine line
--   breeding (AI)  →  stock_movements against semen straw line
--   procurement    →  stock_movements (kind=receipt) against any line
--
-- stock_items.on_hand_qty is maintained by trigger on stock_movements.
-- ===================================================================

-- -------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------
do $$ begin
  create type public.stock_item_kind as enum (
    'feed_material',
    'vet_medicine',
    'semen_straw',
    'consumable',
    'equipment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_movement_kind as enum (
    'opening',
    'receipt',
    'consumption',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'wastage'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wage_period as enum ('daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'leave', 'half_day');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payroll_status as enum ('draft', 'posted', 'paid');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------
-- stock_items — one line per (location, kind, item_ref)
-- -------------------------------------------------------------------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  kind public.stock_item_kind not null,
  -- Optional FK to a catalog row; only one of these is set per row.
  feed_material_id   uuid references public.org_feed_materials(id)   on delete set null,
  vet_medicine_id    uuid references public.org_vet_medicines(id)    on delete set null,
  -- Free-form display label (denorm for fast list rendering + supports custom items)
  display_name text not null,
  unit text not null,                            -- 'kg' / 'L' / 'dose' / 'mL' / 'each'
  on_hand_qty numeric(14, 3) not null default 0,
  reorder_level numeric(14, 3),
  unit_cost_current numeric(14, 4),              -- moving-average or last receipt
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A given catalog item collapses to one line per location.
  unique (location_id, kind, feed_material_id, vet_medicine_id, display_name)
);

create index if not exists stock_items_location_kind_idx
  on public.stock_items(location_id, kind);

drop trigger if exists stock_items_set_updated_at on public.stock_items;
create trigger stock_items_set_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

alter table public.stock_items enable row level security;
drop policy if exists stock_items_select on public.stock_items;
create policy stock_items_select on public.stock_items for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists stock_items_write on public.stock_items;
create policy stock_items_write on public.stock_items for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- stock_movements — signed ledger; source of truth
-- -------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  kind public.stock_movement_kind not null,
  qty_delta numeric(14, 3) not null,             -- signed; receipts +, consumption -
  unit_cost numeric(14, 4),
  occurred_at timestamptz not null default now(),
  source_table text,                             -- e.g. 'feed_events', 'vaccination_events'
  source_id uuid,                                -- FK to the originating event row
  vendor_id uuid references public.location_suppliers(id) on delete set null,
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_item_at_idx
  on public.stock_movements(stock_item_id, occurred_at desc);
create index if not exists stock_movements_source_idx
  on public.stock_movements(source_table, source_id);

alter table public.stock_movements enable row level security;
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.stock_items si
      join public.locations l on l.id = si.location_id
      where si.id = stock_item_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists stock_movements_write on public.stock_movements;
create policy stock_movements_write on public.stock_movements for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.stock_items si
      join public.locations l on l.id = si.location_id
      where si.id = stock_item_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.stock_items si
      join public.locations l on l.id = si.location_id
      where si.id = stock_item_id and l.organization_id = public.auth_org_id()
    )
  );

-- Maintain stock_items.on_hand_qty from movements.
create or replace function public.stock_movements_apply()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.stock_items
       set on_hand_qty = on_hand_qty + new.qty_delta,
           unit_cost_current = case
             when new.kind = 'receipt' and new.unit_cost is not null then new.unit_cost
             else unit_cost_current
           end
     where id = new.stock_item_id;
  elsif tg_op = 'DELETE' then
    update public.stock_items
       set on_hand_qty = on_hand_qty - old.qty_delta
     where id = old.stock_item_id;
  elsif tg_op = 'UPDATE' then
    update public.stock_items
       set on_hand_qty = on_hand_qty - old.qty_delta + new.qty_delta
     where id = new.stock_item_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists stock_movements_apply_trg on public.stock_movements;
create trigger stock_movements_apply_trg
  after insert or update or delete on public.stock_movements
  for each row execute function public.stock_movements_apply();

-- -------------------------------------------------------------------
-- semen_straws — per-location sire dose inventory
-- -------------------------------------------------------------------
create table if not exists public.semen_straws (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  naab text not null,                            -- e.g. '014HO07419'
  sire_name text,
  breed_code text,
  lot text,
  tank_position text,                            -- e.g. 'Tank-1 / Cane-3 / Goblet-A'
  vendor_id uuid references public.location_suppliers(id) on delete set null,
  -- Doses bookkeeping mirrors stock_items ledger for consistency.
  stock_item_id uuid references public.stock_items(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, naab, lot)
);

create index if not exists semen_straws_location_naab_idx
  on public.semen_straws(location_id, naab);

drop trigger if exists semen_straws_set_updated_at on public.semen_straws;
create trigger semen_straws_set_updated_at
  before update on public.semen_straws
  for each row execute function public.set_updated_at();

alter table public.semen_straws enable row level security;
drop policy if exists semen_straws_select on public.semen_straws;
create policy semen_straws_select on public.semen_straws for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists semen_straws_write on public.semen_straws;
create policy semen_straws_write on public.semen_straws for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- feed_events — group/pen-level feeding deliveries
-- -------------------------------------------------------------------
create table if not exists public.feed_events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  group_id uuid references public.location_groups(id) on delete set null,
  pen_id uuid references public.pens(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  as_fed_kg numeric(12, 2) not null,
  dm_kg numeric(12, 2),
  occurred_at timestamptz not null default now(),
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feed_events_location_at_idx
  on public.feed_events(location_id, occurred_at desc);
create index if not exists feed_events_group_idx
  on public.feed_events(group_id, occurred_at desc);

alter table public.feed_events enable row level security;
drop policy if exists feed_events_select on public.feed_events;
create policy feed_events_select on public.feed_events for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists feed_events_write on public.feed_events;
create policy feed_events_write on public.feed_events for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- feed_refusals — leftover (orts) tied to a feeding event
-- -------------------------------------------------------------------
create table if not exists public.feed_refusals (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  group_id uuid references public.location_groups(id) on delete set null,
  pen_id uuid references public.pens(id) on delete set null,
  feed_event_id uuid references public.feed_events(id) on delete set null,
  refusal_kg numeric(12, 2) not null,
  occurred_at timestamptz not null default now(),
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feed_refusals_location_at_idx
  on public.feed_refusals(location_id, occurred_at desc);

alter table public.feed_refusals enable row level security;
drop policy if exists feed_refusals_select on public.feed_refusals;
create policy feed_refusals_select on public.feed_refusals for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists feed_refusals_write on public.feed_refusals;
create policy feed_refusals_write on public.feed_refusals for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- vaccination_events — per-animal or per-group jab
-- -------------------------------------------------------------------
create table if not exists public.vaccination_events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  animal_id uuid references public.animals(id) on delete cascade,
  group_id uuid references public.location_groups(id) on delete set null,
  vaccination_protocol_id uuid references public.org_vaccination_protocols(id) on delete set null,
  vet_medicine_id uuid references public.org_vet_medicines(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  dose_ml numeric(8, 2),
  route text,
  occurred_at timestamptz not null default now(),
  withdrawal_milk_until timestamptz,
  withdrawal_meat_until date,
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (animal_id is not null or group_id is not null)
);

create index if not exists vaccination_events_animal_at_idx
  on public.vaccination_events(animal_id, occurred_at desc);
create index if not exists vaccination_events_location_at_idx
  on public.vaccination_events(location_id, occurred_at desc);

alter table public.vaccination_events enable row level security;
drop policy if exists vaccination_events_select on public.vaccination_events;
create policy vaccination_events_select on public.vaccination_events for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists vaccination_events_write on public.vaccination_events;
create policy vaccination_events_write on public.vaccination_events for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- workers — staff roster per location (not necessarily app users)
-- -------------------------------------------------------------------
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  national_id text,
  phone text,
  role text,                                     -- 'milker' / 'feeder' / 'AI tech' / 'manager' / …
  hire_date date,
  end_date date,
  base_wage_amount numeric(12, 2),
  wage_period public.wage_period default 'monthly',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workers_location_idx on public.workers(location_id);

drop trigger if exists workers_set_updated_at on public.workers;
create trigger workers_set_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

alter table public.workers enable row level security;
drop policy if exists workers_select on public.workers;
create policy workers_select on public.workers for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists workers_write on public.workers;
create policy workers_write on public.workers for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- attendance_events
-- -------------------------------------------------------------------
create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  occurred_date date not null,
  status public.attendance_status not null default 'present',
  hours_worked numeric(5, 2),
  shift text,                                    -- 'morning' / 'evening' / 'night'
  note text,
  created_at timestamptz not null default now(),
  unique (worker_id, occurred_date, shift)
);

create index if not exists attendance_events_worker_idx
  on public.attendance_events(worker_id, occurred_date desc);

alter table public.attendance_events enable row level security;
drop policy if exists attendance_events_select on public.attendance_events;
create policy attendance_events_select on public.attendance_events for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.workers w
      join public.locations l on l.id = w.location_id
      where w.id = worker_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists attendance_events_write on public.attendance_events;
create policy attendance_events_write on public.attendance_events for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.workers w
      join public.locations l on l.id = w.location_id
      where w.id = worker_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.workers w
      join public.locations l on l.id = w.location_id
      where w.id = worker_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- payroll_runs + payroll_lines
-- -------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status public.payroll_status not null default 'draft',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists payroll_runs_location_idx
  on public.payroll_runs(location_id, period_end desc);

drop trigger if exists payroll_runs_set_updated_at on public.payroll_runs;
create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

alter table public.payroll_runs enable row level security;
drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists payroll_runs_write on public.payroll_runs;
create policy payroll_runs_write on public.payroll_runs for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete restrict,
  days_present numeric(5, 2),
  hours_worked numeric(7, 2),
  gross_amount numeric(14, 2) not null default 0,
  deductions_amount numeric(14, 2) not null default 0,
  advances_amount numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) generated always as
    (gross_amount - deductions_amount - advances_amount) stored,
  note text,
  created_at timestamptz not null default now(),
  unique (payroll_run_id, worker_id)
);

alter table public.payroll_lines enable row level security;
drop policy if exists payroll_lines_select on public.payroll_lines;
create policy payroll_lines_select on public.payroll_lines for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.payroll_runs pr
      join public.locations l on l.id = pr.location_id
      where pr.id = payroll_run_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists payroll_lines_write on public.payroll_lines;
create policy payroll_lines_write on public.payroll_lines for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.payroll_runs pr
      join public.locations l on l.id = pr.location_id
      where pr.id = payroll_run_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.payroll_runs pr
      join public.locations l on l.id = pr.location_id
      where pr.id = payroll_run_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- breeding_events: link semen draw + bull
-- -------------------------------------------------------------------
-- Idempotent column adds so existing repro_events can reference a straw row.
do $$ begin
  alter table public.repro_events
    add column if not exists semen_straw_id uuid references public.semen_straws(id) on delete set null;
  alter table public.repro_events
    add column if not exists service_sire_animal_id uuid references public.animals(id) on delete set null;
  alter table public.repro_events
    add column if not exists stock_movement_id uuid references public.stock_movements(id) on delete set null;
exception when undefined_table then null; end $$;


-- ------------------------------------------------------------------
-- File: 0022_tmr_recipes.sql
-- ------------------------------------------------------------------

-- ===================================================================
-- 0022_tmr_recipes.sql
-- TMR (Total Mixed Ration) recipes: a header + per-ingredient lines.
-- A recipe can be assigned to one or more location_groups; feeding
-- events can optionally reference a recipe so the consumed kg are
-- apportioned across its ingredients.
-- ===================================================================

create table if not exists public.tmr_recipes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  description text,
  target_dm_intake_kg numeric(8, 2),       -- target intake per cow per day, DM basis
  target_cows int,                         -- batch headcount the recipe is sized for
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists tmr_recipes_location_idx
  on public.tmr_recipes(location_id);

drop trigger if exists tmr_recipes_set_updated_at on public.tmr_recipes;
create trigger tmr_recipes_set_updated_at
  before update on public.tmr_recipes
  for each row execute function public.set_updated_at();

alter table public.tmr_recipes enable row level security;
drop policy if exists tmr_recipes_select on public.tmr_recipes;
create policy tmr_recipes_select on public.tmr_recipes for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists tmr_recipes_write on public.tmr_recipes;
create policy tmr_recipes_write on public.tmr_recipes for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- Ingredient lines
-- -------------------------------------------------------------------
create table if not exists public.tmr_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.tmr_recipes(id) on delete cascade,
  feed_material_id uuid references public.org_feed_materials(id) on delete set null,
  display_name text not null,              -- denormalised for fast list rendering
  as_fed_kg_per_cow numeric(8, 3) not null default 0,
  display_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (recipe_id, display_name)
);

create index if not exists tmr_recipe_lines_recipe_idx
  on public.tmr_recipe_lines(recipe_id, display_order);

alter table public.tmr_recipe_lines enable row level security;
drop policy if exists tmr_recipe_lines_select on public.tmr_recipe_lines;
create policy tmr_recipe_lines_select on public.tmr_recipe_lines for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists tmr_recipe_lines_write on public.tmr_recipe_lines;
create policy tmr_recipe_lines_write on public.tmr_recipe_lines for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- Group ↔ recipe assignment (one or many recipes per group)
-- -------------------------------------------------------------------
create table if not exists public.tmr_group_assignments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.tmr_recipes(id) on delete cascade,
  group_id uuid not null references public.location_groups(id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (recipe_id, group_id)
);

create index if not exists tmr_group_assignments_group_idx
  on public.tmr_group_assignments(group_id);

alter table public.tmr_group_assignments enable row level security;
drop policy if exists tmr_group_assignments_select on public.tmr_group_assignments;
create policy tmr_group_assignments_select on public.tmr_group_assignments for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists tmr_group_assignments_write on public.tmr_group_assignments;
create policy tmr_group_assignments_write on public.tmr_group_assignments for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );

-- Add recipe FK on feed_events so a feeding can reference its TMR.
do $$ begin
  alter table public.feed_events
    add column if not exists recipe_id uuid references public.tmr_recipes(id) on delete set null;
exception when undefined_table then null; end $$;

