-- =====================================================================
-- 0019_grouping_placement.sql — groups → pens placement.
-- A grouping rule is now a GROUP (strategy) that resolves to YOUR
-- physical pens via a `placement` (none/single/parity/item/capacity).
-- `target_pen` becomes nullable; legacy rows still read via a
-- back-compat adapter in lib/derive/grouping. Run AFTER 0004.
-- Idempotent.
-- =====================================================================

alter table public.grouping_rules
  add column if not exists placement jsonb;

alter table public.grouping_rules
  alter column target_pen drop not null;
