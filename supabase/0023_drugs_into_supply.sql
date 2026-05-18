-- =====================================================================
-- 0023_drugs_into_supply.sql — Phase 23. Supply Chain owns the drug
-- record + stock; Health owns the clinical layer (milk/meat withhold,
-- route, treatments, do-not-ship). The drug catalogue is unified into
-- Supply items in category "Veterinary Drugs & Vaccines" carrying the
-- clinical attrs; Health edits those attrs and records treatments
-- against the same name. Legacy `drug` subjects are left in place
-- (unused, no events reference them) so the change is reversible.
-- Set-based and idempotent. Run AFTER 0022. Safe to re-run.
-- =====================================================================

-- A) Drugs with no matching Supply item yet → create the mirror,
--    carrying the clinical attrs onto it.
insert into public.subjects
  (organization_id, subject_type, natural_key, attrs)
select d.organization_id, 'supply_item', d.natural_key,
       jsonb_build_object(
         'category', 'Veterinary Drugs & Vaccines',
         'unit', 'dose',
         'cost', null,
         'generic_name', null,
         'brand', null,
         'reorder_point', null,
         'default_supplier', null,
         'track_lots', false,
         'track_expiry', false,
         'auto_deduct', 'none',
         'notes', 'Migrated from Health drug catalog',
         'milk_days', coalesce((d.attrs->>'milk_days')::numeric, 0),
         'meat_days', coalesce((d.attrs->>'meat_days')::numeric, 0),
         'route', d.attrs->>'route'
       )
from public.subjects d
where d.subject_type = 'drug'
on conflict (organization_id, subject_type, natural_key) do nothing;

-- B) Drugs whose name already exists as a Supply item → merge the
--    clinical attrs into that item (Health is the clinical source).
update public.subjects si
set attrs = si.attrs || jsonb_build_object(
      'milk_days', coalesce((d.attrs->>'milk_days')::numeric, 0),
      'meat_days', coalesce((d.attrs->>'meat_days')::numeric, 0),
      'route', d.attrs->>'route'
    )
from public.subjects d
where d.subject_type = 'drug'
  and si.subject_type = 'supply_item'
  and si.organization_id = d.organization_id
  and si.natural_key = d.natural_key
  and not (si.attrs ? 'milk_days');
