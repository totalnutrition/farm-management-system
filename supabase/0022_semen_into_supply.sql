-- =====================================================================
-- 0022_semen_into_supply.sql — Phase 22. Supply Chain owns straw stock.
-- Sires becomes genetics metadata only (NAAB, breed, semen type).
-- Each sire that still carries a `straws` count is mirrored into a
-- Supply Chain item (category "Semen & Genetics", unit "straw") with
-- a single opening 210 SRCV receipt so on-hand matches the old count.
-- The legacy count is parked under `legacy_straws` on the sire (not
-- deleted) for traceability. Fully idempotent and set-based:
--   A) ensure the 210 receipt code exists for affected orgs
--   B) create the mirror supply_item (skip if one already exists)
--   C) post the opening receipt once (guarded by a payload marker)
--   D) retire the `straws` attr on the sire
-- Run AFTER 0021. Safe to re-run.
-- =====================================================================

-- A) The opening receipt needs event_code 210 present per org.
insert into public.event_codes
  (organization_id, code, name, label, is_system, provenance)
select distinct s.organization_id, 210, 'SRCV',
       'Stock receipt (Supply Chain)', false,
       'app-defined: Supply Chain'
from public.subjects s
where s.subject_type = 'sire'
  and coalesce((s.attrs->>'straws')::numeric, 0) > 0
on conflict (organization_id, code) do nothing;

-- B) Mirror each sire with straws into a Supply Chain item. If the
--    org already has an item with that natural_key, keep theirs.
insert into public.subjects
  (organization_id, subject_type, natural_key, attrs)
select s.organization_id, 'supply_item', s.natural_key,
       jsonb_build_object(
         'category', 'Semen & Genetics',
         'unit', 'straw',
         'cost', null,
         'generic_name', s.attrs->>'breed',
         'brand', null,
         'reorder_point', null,
         'default_supplier', null,
         'track_lots', false,
         'track_expiry', false,
         'auto_deduct', 'none',
         'notes', 'Migrated from Sires straw inventory'
       )
from public.subjects s
where s.subject_type = 'sire'
  and coalesce((s.attrs->>'straws')::numeric, 0) > 0
on conflict (organization_id, subject_type, natural_key) do nothing;

-- C) Opening receipt for the mirrored quantity, once per sire.
insert into public.events
  (organization_id, subject_id, event_code, event_date, payload, source)
select si.organization_id, si.id, 210, current_date,
       jsonb_build_object(
         'qty', (s.attrs->>'straws')::numeric,
         'unit_cost', null,
         'party', null,
         'migrated_from_sire', s.id::text
       ),
       'system'
from public.subjects s
join public.subjects si
  on si.organization_id = s.organization_id
 and si.subject_type = 'supply_item'
 and si.natural_key = s.natural_key
where s.subject_type = 'sire'
  and coalesce((s.attrs->>'straws')::numeric, 0) > 0
  and not exists (
    select 1 from public.events e
    where e.subject_id = si.id
      and e.payload->>'migrated_from_sire' = s.id::text
  );

-- D) Retire the straws attr on the sire (park it as legacy_straws).
update public.subjects
set attrs = (attrs - 'straws')
            || jsonb_build_object('legacy_straws', attrs->'straws')
where subject_type = 'sire'
  and attrs ? 'straws';
