-- =====================================================================
-- 0020_supply_chain.sql — Phase 20. Supply Chain.
-- A stockable thing is a `supply_item` SUBJECT; user-added stock
-- categories are `supply_category` SUBJECTS. Stock movements are
-- EVENTS on the item subject:
--   210 SRCV  receipt   (+qty, unit_cost, supplier, lot, expiry)
--   212 SADJ  adjust    (±qty: count / spoilage / write-off)
--   213 SPRC  price      (price observation, qty 0)
--   214 SUSE  usage     (−qty: consumption / usage log)
-- On-hand is derived (sum of signed qty) — there is no manual
-- "issue": feed/treatment/breeding auto-deduction is wired in a
-- later phase. Extends the subject_type enum (never rewrites). The
-- new enum values are NOT used in this migration (subjects are
-- created lazily by actions), so it is transaction-safe. Run AFTER
-- 0017. Idempotent.
-- =====================================================================

alter type subject_type add value if not exists 'supply_item';
alter type subject_type add value if not exists 'supply_category';

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 210, 'SRCV', 'Stock receipt (Supply Chain)', false,
     'app-defined: Supply Chain (user-range event, not a DC code)'),
    (org.id, 212, 'SADJ', 'Stock adjustment (Supply Chain)', false,
     'app-defined: Supply Chain (user-range event, not a DC code)'),
    (org.id, 213, 'SPRC', 'Stock price (Supply Chain)', false,
     'app-defined: Supply Chain (user-range event, not a DC code)'),
    (org.id, 214, 'SUSE', 'Stock usage (Supply Chain)', false,
     'app-defined: Supply Chain (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
