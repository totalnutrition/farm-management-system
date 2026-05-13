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
