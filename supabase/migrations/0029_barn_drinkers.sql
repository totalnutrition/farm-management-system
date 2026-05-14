-- ===================================================================
-- 0029_barn_drinkers.sql
-- Adds drinker (waterer) fields to barns. Water access is the most
-- under-asked dairy comfort metric — pen-comfort audits routinely
-- catch under-watered groups even on well-built farms — so we capture
-- count + style + linear feet of access alongside bunk geometry.
-- ===================================================================

do $$ begin
  alter table public.barns
    add column if not exists drinker_count int,
    add column if not exists drinker_type text,
    add column if not exists drinker_linear_ft numeric(8, 2);
exception when undefined_table then null; end $$;

comment on column public.barns.drinker_count is
  'Number of drinker stations (waterers) inside the barn.';
comment on column public.barns.drinker_type is
  'Style of drinker: concrete_trough | tip_trough | individual_bowl | ball_float | fast_fill.';
comment on column public.barns.drinker_linear_ft is
  'Total linear feet of trough water access — feeds water-space-per-cow audits.';
