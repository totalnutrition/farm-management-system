-- ===================================================================
-- 0035_protocol_steps.sql
-- Replaces the vague jsonb "schedule" / "treatment" blobs on the six
-- protocol tables with a proper drug-linked, recurrence-aware steps
-- table — the Bovisync / DC305 model.
--
-- A protocol is a recipe of typed steps. Each step records:
--   - which drug from org_vet_medicines (FK)
--   - dose, route (default from drug, but per-step overridable)
--   - trigger + day offset (when to do this step)
--   - recurrence (one-time / annual / seasonal / every-N-days / etc.)
--
-- The jsonb schedule columns on the existing tables stay in place for
-- read-only backwards compatibility. New code reads from protocol_steps.
-- ===================================================================

-- -------------------------------------------------------------------
-- Missing drugs the seed protocols reference.
-- -------------------------------------------------------------------
insert into public.org_vet_medicines (organization_id, name, brand, active_ingredient, category, route, default_dose, withdrawal_milk_hours, withdrawal_meat_days, is_seed) values
  (null, 'Orbeseal',           'Zoetis',        'Bismuth subnitrate (internal sealant)', 'other',         'IMM',     '4 g per quarter at dry-off', 0,  0,  true),
  (null, 'Eprinex Pour-On',    'Boehringer',    'Eprinomectin 0.5%',                     'parasiticide',  'Topical', '1 mL / 10 kg topical',       0,  0,  true),
  (null, 'Safe-Guard',          'Merck',         'Fenbendazole 10%',                      'parasiticide',  'PO',      '5 mg/kg oral',                0,  8,  true),
  (null, 'Penicillin G LA',     'Multiple',      'Procaine + Benzathine Penicillin',      'antibiotic',    'IM',      '20,000 IU/kg',                96, 14, true),
  (null, 'EAZI-BREED CIDR',     'Zoetis',        'Progesterone 1.38 g insert',            'hormone',       'IU',      '7-day intravaginal insert',   0,  1,  true),
  (null, 'Cobactan LA',         'MSD',           'Cefquinome 7.5%',                       'antibiotic',    'IM',      '1 mg/kg',                     72, 5,  true),
  (null, 'Bovi-Shield Gold One Shot','Zoetis',   'BVD/IBR/BRSV/PI3 (modified-live)',      'vaccine',       'SC',      '2 mL',                        0,  21, true)
on conflict (organization_id, name) do nothing;

-- -------------------------------------------------------------------
-- Step trigger + recurrence enums.
-- -------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'protocol_step_trigger') then
    create type protocol_step_trigger as enum (
      'enrollment_day',            -- day 0 = the cow's protocol enrollment date
      'days_in_milk',              -- DIM-based
      'days_relative_to_calving',  -- -60 = 60 d before calving, +0 = on calving
      'days_relative_to_dry_off',  -- -30 = 30 d before dry-off, 0 = at dry-off
      'days_relative_to_breeding', -- e.g. +28 d post-AI for preg-check
      'days_before_breeding',      -- pre-breeding vaccinations (negative offset)
      'age_days',                  -- calf age-based
      'recurrence_only',           -- e.g. annual / quarterly / seasonal — pure repeat
      'seasonal'                   -- pegged to spring / autumn / etc.
    );
  end if;
end$$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'protocol_step_recurrence') then
    create type protocol_step_recurrence as enum (
      'once',
      'annual',
      'semi_annual',
      'quarterly',
      'monthly',
      'weekly',
      'every_n_days',
      'seasonal_spring',
      'seasonal_autumn',
      'seasonal_spring_autumn',
      'every_lactation'
    );
  end if;
end$$;

-- -------------------------------------------------------------------
-- protocol_steps — polymorphic on (protocol_kind, protocol_id).
-- No FK constraint on protocol_id because the target table varies.
-- -------------------------------------------------------------------
create table if not exists public.protocol_steps (
  id uuid primary key default gen_random_uuid(),
  protocol_kind text not null check (protocol_kind in (
    'repro', 'vaccination', 'treatment', 'hoof_trim', 'deworming', 'dry_off'
  )),
  protocol_id uuid not null,
  step_no int not null,
  label text not null,
  drug_id uuid references public.org_vet_medicines(id) on delete set null,
  dose_amount text,                 -- "100" / "2" / "500" — paired with dose_unit
  dose_unit text,                   -- 'mcg' / 'mL' / 'mg' / 'IU' / 'g' / 'tube'
  route text,                       -- 'IM' / 'SC' / 'IV' / 'IMM' / 'PO' / 'Topical' / 'IU'
  trigger protocol_step_trigger not null,
  at_offset_days int,
  recurrence protocol_step_recurrence not null default 'once',
  every_n_days int,                 -- when recurrence = 'every_n_days'
  withdrawal_milk_hours int,
  withdrawal_meat_days int,
  notes text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (protocol_kind, protocol_id, step_no)
);

create index if not exists protocol_steps_lookup_idx
  on public.protocol_steps (protocol_kind, protocol_id, step_no);

alter table public.protocol_steps enable row level security;

-- RLS: a step is visible if its parent protocol is visible to the user.
-- Org policies on the protocol tables already enforce that.
drop policy if exists protocol_steps_select on public.protocol_steps;
create policy protocol_steps_select on public.protocol_steps for select
  using (true); -- protocols are org-scoped or seed; parent visibility is the gate

drop policy if exists protocol_steps_write on public.protocol_steps;
create policy protocol_steps_write on public.protocol_steps for all
  using (public.auth_role() in ('super_admin', 'admin'))
  with check (public.auth_role() in ('super_admin', 'admin'));

-- -------------------------------------------------------------------
-- Helper: insert a step by drug name (looks up the seed drug).
-- We use this instead of repeating the join in every insert.
-- -------------------------------------------------------------------

-- -------------------------------------------------------------------
-- REPRO PROTOCOLS — typed steps for Ovsynch / Presynch / etc.
-- -------------------------------------------------------------------

-- Ovsynch: GnRH → 7d → PGF → 2d → GnRH → ~16h → AI
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'repro', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_repro_protocols p
left join lateral (values
  (1, 'GnRH — first injection',  'Cystorelin',  '100',  'mcg', 'IM', 'enrollment_day', 0, 'once'),
  (2, 'PGF2α',                   'Lutalyse',    '25',   'mg',  'IM', 'enrollment_day', 7, 'once'),
  (3, 'GnRH — second injection', 'Cystorelin',  '100',  'mcg', 'IM', 'enrollment_day', 9, 'once'),
  (4, 'Timed AI (16-24 h after GnRH)', null,    null,   null,  null, 'enrollment_day', 10, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'ovsynch' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Presynch-Ovsynch: 2× PGF 14 d apart → Ovsynch starting 14 d later
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'repro', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_repro_protocols p
left join lateral (values
  (1, 'PGF — presynch dose 1',   'Lutalyse',    '25',  'mg',  'IM', 'enrollment_day', -28, 'once'),
  (2, 'PGF — presynch dose 2',   'Lutalyse',    '25',  'mg',  'IM', 'enrollment_day', -14, 'once'),
  (3, 'GnRH — first injection',  'Cystorelin',  '100', 'mcg', 'IM', 'enrollment_day', 0,   'once'),
  (4, 'PGF2α',                   'Lutalyse',    '25',  'mg',  'IM', 'enrollment_day', 7,   'once'),
  (5, 'GnRH — second injection', 'Cystorelin',  '100', 'mcg', 'IM', 'enrollment_day', 9,   'once'),
  (6, 'Timed AI',                null,          null,  null,  null, 'enrollment_day', 10,  'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'presynch-ovsynch' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Double-Ovsynch
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'repro', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_repro_protocols p
left join lateral (values
  (1, 'GnRH — pre-cycle',          'Cystorelin', '100', 'mcg', 'IM', 'enrollment_day', -10, 'once'),
  (2, 'PGF — pre-cycle',           'Lutalyse',   '25',  'mg',  'IM', 'enrollment_day', -3,  'once'),
  (3, 'GnRH — Ovsynch start',      'Cystorelin', '100', 'mcg', 'IM', 'enrollment_day', 0,   'once'),
  (4, 'PGF2α',                     'Lutalyse',   '25',  'mg',  'IM', 'enrollment_day', 7,   'once'),
  (5, 'GnRH — second',             'Cystorelin', '100', 'mcg', 'IM', 'enrollment_day', 9,   'once'),
  (6, 'Timed AI',                  null,         null,  null,  null, 'enrollment_day', 10,  'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'double-ovsynch' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Resynch (open at preg-check)
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'repro', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_repro_protocols p
left join lateral (values
  (1, 'GnRH at preg-check open', 'Cystorelin', '100', 'mcg', 'IM', 'days_relative_to_breeding', 32, 'once'),
  (2, 'PGF2α',                   'Lutalyse',   '25',  'mg',  'IM', 'days_relative_to_breeding', 39, 'once'),
  (3, 'GnRH — second',           'Cystorelin', '100', 'mcg', 'IM', 'days_relative_to_breeding', 41, 'once'),
  (4, 'Timed AI',                null,         null,  null,  null, 'days_relative_to_breeding', 42, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'resynch' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- CIDR-Sync: Ovsynch with a 7-day CIDR insert overlaid
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'repro', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_repro_protocols p
left join lateral (values
  (1, 'GnRH + insert CIDR',       'Cystorelin',       '100', 'mcg', 'IM', 'enrollment_day', 0, 'once'),
  (2, 'CIDR insert',              'EAZI-BREED CIDR',  '1',   'insert', 'IU', 'enrollment_day', 0, 'once'),
  (3, 'Remove CIDR + PGF',        'Lutalyse',         '25',  'mg',  'IM', 'enrollment_day', 7, 'once'),
  (4, 'GnRH — second',            'Cystorelin',       '100', 'mcg', 'IM', 'enrollment_day', 9, 'once'),
  (5, 'Timed AI',                 null,               null,  null,  null, 'enrollment_day', 10, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'cidr-sync' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- -------------------------------------------------------------------
-- VACCINATION PROTOCOLS — every step references an actual vaccine.
-- -------------------------------------------------------------------

-- Adult cow annual — one shot per year
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'vaccination', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_vaccination_protocols p
left join lateral (values
  (1, 'Adult booster — 5-way viral + Lepto5', 'Bovi-Shield Gold FP5 VL5', '2', 'mL', 'SC', 'recurrence_only', null, 'annual')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'adult-annual' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Pre-breeding heifer
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'vaccination', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_vaccination_protocols p
left join lateral (values
  (1, 'Primer 6 weeks before breeding',  'Bovi-Shield Gold FP5 VL5', '2', 'mL', 'SC', 'days_before_breeding', 45, 'once'),
  (2, 'Booster 2 weeks before breeding', 'Bovi-Shield Gold FP5 VL5', '2', 'mL', 'SC', 'days_before_breeding', 14, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'pre-breeding-heifer' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Calf series (BRD prevention + Clostridial)
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'vaccination', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_vaccination_protocols p
left join lateral (values
  (1, 'BVD primer at 30 d',     'Bovi-Shield Gold One Shot', '2', 'mL', 'SC', 'age_days', 30, 'once'),
  (2, 'BVD booster at 60 d',    'Bovi-Shield Gold One Shot', '2', 'mL', 'SC', 'age_days', 60, 'once'),
  (3, 'Clostridial 7-way at 90 d', 'Vision 7 / Tasvax 8',    '2', 'mL', 'SC', 'age_days', 90, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'calf-series' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Dry-off mastitis J5 series
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'vaccination', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_vaccination_protocols p
left join lateral (values
  (1, 'J5 primer (60 d pre dry-off)', 'J-Vac / J-5', '5', 'mL', 'SC', 'days_relative_to_dry_off', -60, 'once'),
  (2, 'J5 booster (30 d pre dry-off)', 'J-Vac / J-5', '5', 'mL', 'SC', 'days_relative_to_dry_off', -30, 'once'),
  (3, 'J5 booster (post-calving)',    'J-Vac / J-5', '5', 'mL', 'SC', 'days_relative_to_calving', 1, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'dry-off-mastitis' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- -------------------------------------------------------------------
-- HOOF TRIM PROTOCOLS — no drug, just trim events.
-- -------------------------------------------------------------------

insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, trigger, at_offset_days, recurrence, is_seed)
select 'hoof_trim', p.id, v.step_no, v.label, null, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_hoof_trim_protocols p, lateral (values
  (1, 'Pre-breeding trim',    'days_in_milk', 50, 'once'),
  (2, 'Mid-lactation trim',   'days_in_milk', 180, 'once')
) v(step_no, label, trigger, at_offset_days, recurrence)
where p.slug = 'twice-yearly' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, trigger = excluded.trigger,
  at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, trigger, at_offset_days, recurrence, is_seed)
select 'hoof_trim', p.id, 1, 'Trim 30 d before dry-off', 'days_relative_to_dry_off', -30, 'once', true
from public.org_hoof_trim_protocols p
where p.slug = 'pre-dry-off' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, trigger = excluded.trigger,
  at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, trigger, at_offset_days, recurrence, is_seed)
select 'hoof_trim', p.id, 1, 'Heifer first trim — 60 d pre-calving', 'days_relative_to_calving', -60, 'once', true
from public.org_hoof_trim_protocols p
where p.slug = 'heifer-pre-calving' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, trigger = excluded.trigger,
  at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- -------------------------------------------------------------------
-- DEWORMING PROTOCOLS — drug-linked anthelmintic schedules.
-- -------------------------------------------------------------------

-- Calf starter
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'deworming', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, v.trigger::protocol_step_trigger, v.at_offset_days, v.recurrence::protocol_step_recurrence, true
from public.org_deworming_protocols p
left join lateral (values
  (1, 'Fenbendazole at 60 d',      'Safe-Guard',       '5',   'mg/kg', 'PO',      'age_days', 60,  'once'),
  (2, 'Eprinomectin at 180 d',     'Eprinex Pour-On',  '500', 'mcg/kg', 'Topical', 'age_days', 180, 'once')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'calf-starter' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  trigger = excluded.trigger, at_offset_days = excluded.at_offset_days, recurrence = excluded.recurrence;

-- Lactating spring + autumn
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, recurrence, is_seed)
select 'deworming', p.id, 1, 'Eprinomectin — twice yearly (spring + autumn)', d.id, '500', 'mcg/kg', 'Topical', 'seasonal'::protocol_step_trigger, 'seasonal_spring_autumn'::protocol_step_recurrence, true
from public.org_deworming_protocols p
join public.org_vet_medicines d on d.name = 'Eprinex Pour-On' and d.organization_id is null
where p.slug = 'lactating-spring-fall' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  drug_id = excluded.drug_id, label = excluded.label,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route;

-- Heifer pre-calving
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'deworming', p.id, 1, 'Eprinomectin 30 d before first calving', d.id, '500', 'mcg/kg', 'Topical', 'days_relative_to_calving'::protocol_step_trigger, -30, 'once'::protocol_step_recurrence, true
from public.org_deworming_protocols p
join public.org_vet_medicines d on d.name = 'Eprinex Pour-On' and d.organization_id is null
where p.slug = 'heifer-pre-calving' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  drug_id = excluded.drug_id, label = excluded.label,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route;

-- -------------------------------------------------------------------
-- DRY-OFF PROTOCOLS — antibiotic + sealant per quarter.
-- -------------------------------------------------------------------

-- Blanket DCT + sealant
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, notes, is_seed)
select 'dry_off', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, 'days_relative_to_dry_off'::protocol_step_trigger, 0, 'once'::protocol_step_recurrence, v.notes, true
from public.org_dry_off_protocols p
left join lateral (values
  (1, 'Antibiotic — all quarters at dry-off', 'Spectramast DC', '500', 'mg',      'IMM', 'Long-acting ceftiofur in every quarter.'),
  (2, 'Internal teat sealant — all quarters', 'Orbeseal',       '4',   'g',       'IMM', 'Applied immediately after the antibiotic.')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, notes) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'blanket-with-sealant' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  notes = excluded.notes;

-- Selective DCT (SCC-driven) — antibiotic only if criteria met; sealant always
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, notes, is_seed)
select 'dry_off', p.id, v.step_no, v.label, d.id, v.dose_amount, v.dose_unit, v.route, 'days_relative_to_dry_off'::protocol_step_trigger, 0, 'once'::protocol_step_recurrence, v.notes, true
from public.org_dry_off_protocols p
left join lateral (values
  (1, 'Antibiotic (only if SCC > 200,000 or clinical case)', 'Spectramast DC', '500', 'mg', 'IMM', 'Selective: skip if no qualifying criteria.'),
  (2, 'Internal teat sealant — all quarters',                'Orbeseal',       '4',   'g',  'IMM', 'Every cow regardless of SCC.')
) v(step_no, label, drug_name, dose_amount, dose_unit, route, notes) on true
left join public.org_vet_medicines d on d.name = v.drug_name and d.organization_id is null
where p.slug = 'selective-scc-driven' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  label = excluded.label, drug_id = excluded.drug_id,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route,
  notes = excluded.notes;

-- Sealant only (organic / withdrawal-sensitive)
insert into public.protocol_steps (protocol_kind, protocol_id, step_no, label, drug_id, dose_amount, dose_unit, route, trigger, at_offset_days, recurrence, is_seed)
select 'dry_off', p.id, 1, 'Internal teat sealant — all quarters (no antibiotic)', d.id, '4', 'g', 'IMM', 'days_relative_to_dry_off'::protocol_step_trigger, 0, 'once'::protocol_step_recurrence, true
from public.org_dry_off_protocols p
join public.org_vet_medicines d on d.name = 'Orbeseal' and d.organization_id is null
where p.slug = 'sealant-only' and p.organization_id is null
on conflict (protocol_kind, protocol_id, step_no) do update set
  drug_id = excluded.drug_id, label = excluded.label,
  dose_amount = excluded.dose_amount, dose_unit = excluded.dose_unit, route = excluded.route;

comment on table public.protocol_steps is
  'Typed, drug-linked steps for each protocol. Replaces the vague jsonb schedule columns. Bovisync / DC305 alignment.';
