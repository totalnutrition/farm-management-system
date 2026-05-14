-- ===================================================================
-- 0024_pen_capacity_fields.sql
-- Add running-bunk-feet + per-pen stocking target override.
-- Pens at a dairy are flexible (movable partitions) — capacity is
-- user-stated, not a hard constraint. Over- and under-stocking are
-- cautions, not blocks.
-- ===================================================================

do $$ begin
  alter table public.pens
    add column if not exists bunk_running_ft numeric(8, 2),
    add column if not exists stocking_target_pct numeric(5, 2);
exception when undefined_table then null; end $$;

comment on column public.pens.capacity_head is
  'User-stated head capacity — soft target, not a hard limit.';
comment on column public.pens.bunk_running_ft is
  'Running feet of feed bunk inside the pen — drives bunk-space-per-cow.';
comment on column public.pens.stocking_target_pct is
  'Optional per-pen override of the org default stocking %. NULL = use group class default.';
