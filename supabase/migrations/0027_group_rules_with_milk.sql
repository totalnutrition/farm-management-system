-- ===================================================================
-- 0027_group_rules_with_milk.sql
-- Production-FIRST lactating groups. Adds daily_milk_min /
-- daily_milk_max predicates to the High / Mid / Low rules across the
-- 2-group, 3-group and 4-group herd-structure presets — and updates
-- already-instantiated location_groups rows that still hold the
-- old DIM-only rules.
--
-- Engine semantics for the milk predicate are lenient: if a cow has
-- no recent milkings, the predicate is skipped rather than failing
-- the rule. So farms without per-cow recording fall back to the DIM
-- behaviour they had before; farms that DO record see production
-- becomes the primary signal.
--
-- Defaults baked in (kg / cow / day, 7-day avg):
--                   high  mid range  low
--   2-group         ≥ 25  (none)     ≤ 25
--   3-group         ≥ 30  18 – 30    ≤ 18
--   4-group         ≥ 30  18 – 30    ≤ 18
-- Customizable per location once the Edit rule UI ships.
-- ===================================================================

-- ---------- 2-group preset ----------
update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 25}'::jsonb
 where group_slug = 'high'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '2-group' and organization_id is null
   );

update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_max": 25}'::jsonb
 where group_slug = 'low'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '2-group' and organization_id is null
   );

-- ---------- 3-group preset ----------
update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 30}'::jsonb
 where group_slug = 'high'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '3-group' and organization_id is null
   );

update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 18, "daily_milk_max": 30}'::jsonb
 where group_slug = 'mid'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '3-group' and organization_id is null
   );

update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_max": 18}'::jsonb
 where group_slug = 'low'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '3-group' and organization_id is null
   );

-- ---------- 4-group preset ----------
update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 30}'::jsonb
 where group_slug = 'high'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '4-group' and organization_id is null
   );

update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 18, "daily_milk_max": 30}'::jsonb
 where group_slug = 'mid'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '4-group' and organization_id is null
   );

update public.org_group_strategy_preset_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_max": 18}'::jsonb
 where group_slug = 'low'
   and preset_id = (
     select id from public.org_group_strategy_presets
     where slug = '4-group' and organization_id is null
   );

-- ---------- Active location_groups (carry the same change forward) ----------
-- Only rewrite rows that still match the old DIM-only predicates, so
-- locations that already customised their rules are untouched.

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 25}'::jsonb
 where preset_slug = '2-group'
   and group_slug = 'high'
   and rule_predicates = '{"dim_min": 22, "dim_max": 150}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_max": 25}'::jsonb
 where preset_slug = '2-group'
   and group_slug = 'low'
   and rule_predicates = '{"dim_min": 151}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 30}'::jsonb
 where preset_slug = '3-group'
   and group_slug = 'high'
   and rule_predicates = '{"dim_min": 22, "dim_max": 150}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 18, "daily_milk_max": 30}'::jsonb
 where preset_slug = '3-group'
   and group_slug = 'mid'
   and rule_predicates = '{"dim_min": 151, "dim_max": 250}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_max": 18}'::jsonb
 where preset_slug = '3-group'
   and group_slug = 'low'
   and rule_predicates = '{"dim_min": 251}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 30}'::jsonb
 where preset_slug = '4-group'
   and group_slug = 'high'
   and rule_predicates = '{"dim_min": 22, "dim_max": 150}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_min": 18, "daily_milk_max": 30}'::jsonb
 where preset_slug = '4-group'
   and group_slug = 'mid'
   and rule_predicates = '{"dim_min": 151, "dim_max": 250}'::jsonb;

update public.location_groups
   set rule_predicates = '{"dim_min": 22, "daily_milk_max": 18}'::jsonb
 where preset_slug = '4-group'
   and group_slug = 'low'
   and rule_predicates = '{"dim_min": 251}'::jsonb;
