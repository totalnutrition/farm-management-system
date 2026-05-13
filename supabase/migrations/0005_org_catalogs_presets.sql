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
