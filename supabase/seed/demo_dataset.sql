-- ===================================================================
-- demo_dataset.sql — populate the active location with realistic
-- sample data so every recent feature lights up.
--
-- BEFORE RUNNING:
--   1. If your location is NOT called 'Example Location', do a find-
--      replace: 'Example Location' → '<your location name>'.
--      (Run `select id, name from public.locations` to confirm.)
--   2. Migrations 0030-0034 must be applied (sires, protocols,
--      farm_rounds, location_playbook).
--   3. Needs at least ~6 active female cows in the location for the
--      health / repro / round inserts to populate fully. Fewer is
--      fine — guarded inserts skip cleanly.
--
-- Re-runnable: every insert uses on conflict do nothing / not exists.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Sires catalog — 5 Holstein bulls with realistic PTAs.
-- -------------------------------------------------------------------
with org as (
  select organization_id from public.locations
   where name = 'Example Location' limit 1
)
insert into public.sires (
  organization_id, naab, registered_name, short_name, breed_code,
  status, country_of_origin, owner_company,
  ptam_milk_kg, ptam_fat_kg, ptam_protein_kg, ptam_scs, ptam_dpr,
  ptam_calving_ease_pct, ptam_productive_life, net_merit, notes
) select org.organization_id, v.* from org, (values
  ('014HO07419', 'Cogent Apprentice',     'Apprentice', 'HO', 'active'::sire_status, 'US', 'Cogent',
    900::numeric, 35::numeric, 28::numeric, 2.85::numeric, 1.2::numeric, 6.5::numeric, 4.2::numeric, 870::numeric,
    'High milk + good components.'),
  ('029HO19874', 'Semex Renegade',        'Renegade',   'HO', 'active'::sire_status, 'CA', 'Semex',
    600::numeric, 40::numeric, 25::numeric, 2.70::numeric, 2.5::numeric, 7.2::numeric, 5.0::numeric, 920::numeric,
    'Component-corrected, daughter pregnancy positive.'),
  ('007HO15622', 'Select Sires Champion', 'Champion',   'HO', 'active'::sire_status, 'US', 'Select Sires',
    1100::numeric, 38::numeric, 32::numeric, 2.95::numeric, 0.8::numeric, 5.8::numeric, 3.5::numeric, 760::numeric,
    'Volume bull. Watch SCC + DPR.'),
  ('200HO11055', 'CRV Bouw Genio',        'Genio',      'HO', 'active'::sire_status, 'NL', 'CRV',
    750::numeric, 42::numeric, 27::numeric, 2.65::numeric, 3.1::numeric, 8.0::numeric, 5.5::numeric, 950::numeric,
    'Grazing-system favourite. Excellent feet & legs.'),
  ('011HO11820', 'ABS Goldwyn II',        'Goldwyn II', 'HO', 'active'::sire_status, 'US', 'ABS',
    500::numeric, 30::numeric, 22::numeric, 2.80::numeric, 1.8::numeric, 7.0::numeric, 4.5::numeric, 690::numeric,
    'Daughter conformation, modest milk.')
) as v(naab, registered_name, short_name, breed_code, status, country_of_origin, owner_company,
       ptam_milk_kg, ptam_fat_kg, ptam_protein_kg, ptam_scs, ptam_dpr,
       ptam_calving_ease_pct, ptam_productive_life, net_merit, notes)
on conflict (organization_id, naab) do nothing;

-- -------------------------------------------------------------------
-- 2. Operations Playbook — pick protocols + KPI overrides.
-- -------------------------------------------------------------------
with loc as (
  select id from public.locations where name = 'Example Location' limit 1
),
seed as (
  select
    (select id from public.org_repro_protocols       where slug = 'ovsynch'                and organization_id is null) as repro_id,
    (select id from public.org_vaccination_protocols where slug = 'adult-annual'           and organization_id is null) as vax_id,
    (select id from public.org_treatment_protocols   limit 1)                                                            as tx_id,
    (select id from public.org_hoof_trim_protocols   where slug = 'twice-yearly'           and organization_id is null) as hoof_id,
    (select id from public.org_deworming_protocols   where slug = 'lactating-spring-fall'  and organization_id is null) as deworm_id,
    (select id from public.org_dry_off_protocols     where slug = 'blanket-with-sealant'   and organization_id is null) as dry_id
)
insert into public.location_playbook (
  location_id,
  repro_protocol_id, vaccination_protocol_id, treatment_protocol_id,
  hoof_trim_protocol_id, deworming_protocol_id, dry_off_protocol_id,
  kpi_overrides, notes
)
select loc.id, seed.repro_id, seed.vax_id, seed.tx_id, seed.hoof_id, seed.deworm_id, seed.dry_id,
  jsonb_build_object(
    'pr21_target_pct',                  24,
    'cr_target_pct',                    42,
    'days_open_target',                 105,
    'lameness_locomotion_threshold',    3,
    'scc_ceiling_thousands',            200,
    'refusal_target_pct',               2.5,
    'dmi_target_kg',                    23
  ),
  'Demo defaults — high-yielder targets.'
from loc, seed
on conflict (location_id) do update set
  repro_protocol_id       = excluded.repro_protocol_id,
  vaccination_protocol_id = excluded.vaccination_protocol_id,
  treatment_protocol_id   = excluded.treatment_protocol_id,
  hoof_trim_protocol_id   = excluded.hoof_trim_protocol_id,
  deworming_protocol_id   = excluded.deworming_protocol_id,
  dry_off_protocol_id     = excluded.dry_off_protocol_id,
  kpi_overrides           = excluded.kpi_overrides;

-- -------------------------------------------------------------------
-- 3. Stock items — feed + vet meds + 2 below reorder.
-- -------------------------------------------------------------------
with loc as (
  select id from public.locations where name = 'Example Location' limit 1
),
items(display_name, kind, unit, on_hand_qty, reorder_level, unit_cost_current) as (
  values
    ('Maize silage',             'feed_material'::stock_item_kind, 'kg', 18000::numeric, 5000::numeric,  18::numeric),
    ('Wheat straw',              'feed_material'::stock_item_kind, 'kg',  4200::numeric, 1500::numeric,  12::numeric),
    ('Cottonseed meal',          'feed_material'::stock_item_kind, 'kg',   320::numeric,  500::numeric,  85::numeric),
    ('Wanda concentrate',        'feed_material'::stock_item_kind, 'kg',  1100::numeric, 1000::numeric,  92::numeric),
    ('Penicillin G LA',          'vet_medicine'::stock_item_kind,  'mL',    80::numeric,  200::numeric, 380::numeric),
    ('Cefquinome 150 mg',        'vet_medicine'::stock_item_kind,  'tube', 220::numeric,   80::numeric, 540::numeric),
    ('Footbath copper sulphate', 'consumable'::stock_item_kind,    'kg',    45::numeric,   20::numeric, 220::numeric)
)
insert into public.stock_items (location_id, kind, display_name, unit, on_hand_qty, reorder_level, unit_cost_current)
select loc.id, items.kind, items.display_name, items.unit, items.on_hand_qty, items.reorder_level, items.unit_cost_current
from loc, items
on conflict (location_id, kind, feed_material_id, vet_medicine_id, display_name) do nothing;

-- -------------------------------------------------------------------
-- 4. Sample suppliers.
-- -------------------------------------------------------------------
with loc as (
  select id from public.locations where name = 'Example Location' limit 1
),
v(name, category) as (
  values
    ('AgriPak Feeds',      'feed'),
    ('Sialkot Vet Pharma', 'vet'),
    ('Genus ABS Pakistan', 'genetics'),
    ('Lahore Forage Co.',  'feed')
)
insert into public.location_suppliers (location_id, name, category)
select loc.id, v.name, v.category
from loc, v
where not exists (
  select 1 from public.location_suppliers s
  where s.location_id = loc.id and s.name = v.name
);

-- -------------------------------------------------------------------
-- 5. Health events — 2 active withdrawals, 1 expiring today, 3 lame.
--    Picks the first 6 active cows by animal_id.
-- -------------------------------------------------------------------
with cows as (
  select a.id, row_number() over (order by a.animal_id) as rn
  from public.animals a
  join public.locations l on l.id = a.location_id
  where l.name = 'Example Location' and a.status = 'active'
  order by a.animal_id
  limit 6
),
heparams(rn, dx, ls, drug, milk_wd_end_offset_h, severity) as (
  values
    (1, 'mastitis (left rear)',  null::int, 'Cefquinome 150 mg',  120, 3),
    (2, 'metritis',               null::int, 'Penicillin G LA',     72, 4),
    (3, 'foot abscess',           null::int, 'Penicillin G LA',     20, 3),
    (4, 'lameness',               3,         null,                   0, 3),
    (5, 'lameness',               4,         null,                   0, 4),
    (6, 'lameness',               3,         null,                   0, 3)
)
insert into public.health_events (
  animal_id, event_date, event_type, diagnosis_text, locomotion_score,
  severity, drug_name, withdrawal_milk_end, notes
)
select
  c.id,
  current_date - 2,
  'diagnosis'::health_event_type,
  p.dx,
  p.ls,
  p.severity,
  p.drug,
  case when p.milk_wd_end_offset_h > 0
       then now() + (p.milk_wd_end_offset_h || ' hours')::interval
       else null
  end,
  'Demo seed.'
from cows c
join heparams p on p.rn = c.rn
where not exists (
  select 1 from public.health_events he
  where he.animal_id = c.id
    and he.notes = 'Demo seed.'
    and he.diagnosis_text = p.dx
);

-- -------------------------------------------------------------------
-- 6. Repro events — 2 cows due to calve in ~10 d, 2 open >150 DIM.
-- -------------------------------------------------------------------
with cows as (
  select a.id, a.last_calving_date, row_number() over (order by a.animal_id desc) as rn
  from public.animals a
  join public.locations l on l.id = a.location_id
  where l.name = 'Example Location' and a.status = 'active' and a.sex = 'F'
  order by a.animal_id desc
  limit 4
)
insert into public.repro_events (
  animal_id, event_date, event_type, result, days_pregnant, notes
)
select c.id, current_date - 1, 'preg_check'::repro_event_type,
  case when c.rn <= 2 then 'pregnant' else 'open' end,
  case when c.rn <= 2 then 270 else null end,
  'Demo seed: ' || (case when c.rn <= 2 then 'due to calve ~10 d' else 'open >150 DIM' end)
from cows c
where not exists (
  select 1 from public.repro_events re
  where re.animal_id = c.id and re.notes like 'Demo seed:%'
);

-- For the open-cows alert to actually fire, those cows need
-- last_calving_date > 150 days ago + current_lactation > 0.
with cows as (
  select a.id, row_number() over (order by a.animal_id desc) as rn
  from public.animals a
  join public.locations l on l.id = a.location_id
  where l.name = 'Example Location' and a.status = 'active' and a.sex = 'F'
  order by a.animal_id desc
  limit 4
)
update public.animals a
   set last_calving_date = current_date - 200,
       current_lactation = coalesce(a.current_lactation, 1)
  from cows c
 where a.id = c.id and c.rn between 3 and 4
   and (a.last_calving_date is null or a.last_calving_date > current_date - 150);

-- -------------------------------------------------------------------
-- 7. A sample procurement receipt (cottonseed meal restock).
-- -------------------------------------------------------------------
with loc as (
  select id from public.locations where name = 'Example Location' limit 1
),
si as (
  select s.id from public.stock_items s
  join loc on loc.id = s.location_id
  where s.display_name = 'Cottonseed meal' limit 1
),
sup as (
  select sp.id from public.location_suppliers sp
  join loc on loc.id = sp.location_id
  where sp.name = 'AgriPak Feeds' limit 1
)
insert into public.stock_movements (
  stock_item_id, kind, qty_delta, unit_cost, occurred_at,
  source_table, vendor_id, note
)
select si.id, 'receipt'::stock_movement_kind, 800, 88, now() - interval '3 hours',
  'procurement_receipts', sup.id, 'Demo seed receipt.'
from si, sup
where not exists (
  select 1 from public.stock_movements m
  where m.stock_item_id = si.id and m.note = 'Demo seed receipt.'
);

-- -------------------------------------------------------------------
-- 8. Farm round — one active round with 3 observations.
-- -------------------------------------------------------------------
do $$
declare
  loc_id uuid;
  rnd_id uuid;
  cow_id uuid;
  i int := 0;
begin
  select id into loc_id from public.locations
   where name = 'Example Location' limit 1;
  if loc_id is null then return; end if;

  select id into rnd_id from public.farm_rounds
   where location_id = loc_id and notes = 'Demo seed round.' limit 1;
  if rnd_id is not null then return; end if;

  insert into public.farm_rounds (location_id, supervisor_name, notes, status)
  values (loc_id, 'Asad (demo)', 'Demo seed round.', 'active')
  returning id into rnd_id;

  for cow_id in
    select a.id from public.animals a
     where a.location_id = loc_id and a.status = 'active'
     order by a.animal_id
     limit 3
  loop
    i := i + 1;
    if i = 1 then
      insert into public.repro_events (animal_id, event_date, event_type, notes, round_id)
      values (cow_id, current_date, 'heat'::repro_event_type, 'Standing heat seen at AM round.', rnd_id);
    elsif i = 2 then
      insert into public.health_events (animal_id, event_date, event_type, diagnosis_text, severity, notes, round_id)
      values (cow_id, current_date, 'diagnosis'::health_event_type, 'sick (round)', 2, 'Off feed, dull eyes.', rnd_id);
    else
      insert into public.health_events (animal_id, event_date, event_type, diagnosis_text, locomotion_score, severity, notes, round_id)
      values (cow_id, current_date, 'diagnosis'::health_event_type, 'lameness', 3, 3, 'Mild left rear.', rnd_id);
    end if;
  end loop;
end$$;

-- -------------------------------------------------------------------
-- Done. After running, reload these pages to see the data:
--   /hot-list
--   /rounds
--   /animals/<any-cow>
--   /settings/organization/sires
--   /settings/locations/<active>/playbook
--   /procurement
-- -------------------------------------------------------------------
select 'Seed complete.' as note;
