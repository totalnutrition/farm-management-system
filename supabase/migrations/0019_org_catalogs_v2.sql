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
