-- =====================================================================
-- 0005_grouping_split.sql — Phase 7+: a grouping rule may target a
-- single pen OR split by parity into two pens. Run AFTER 0004.
-- Idempotent.
-- =====================================================================

alter table public.grouping_rules
  add column if not exists split jsonb;       -- {firstLactation, mature} | null

alter table public.grouping_rules
  alter column target_pen drop not null;      -- null when `split` is used
