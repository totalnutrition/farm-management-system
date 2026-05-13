-- =====================================================================
-- 0020 — Animal life stage (DC305-style classification)
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'animal_life_stage') then
    create type animal_life_stage as enum (
      'calf',             -- 0-6 months pre-weaning / pre-breeding
      'weaned_heifer',    -- weaned, 2-6 months
      'breeding_heifer',  -- 6+ months eligible to breed, open
      'bred_heifer',      -- pregnant, never lactated
      'lactating',        -- currently milking
      'dry',              -- parity >= 1, dried off
      'bull',
      'other'
    );
  end if;
end $$;

alter table public.animals
  add column if not exists life_stage animal_life_stage not null default 'other';

-- Backfill existing rows with a reasonable heuristic. Only touches rows
-- still at the default ('other') so re-running is safe.
update public.animals
   set life_stage = case
     when sex = 'male' then 'bull'::animal_life_stage
     when current_lactation is not null and current_lactation > 0 and last_calving_date is not null
       then 'lactating'::animal_life_stage
     when current_lactation is not null and current_lactation > 0 and last_calving_date is null
       then 'dry'::animal_life_stage
     when sex = 'female' and (current_lactation is null or current_lactation = 0)
       then 'breeding_heifer'::animal_life_stage
     else 'other'::animal_life_stage
   end
 where life_stage = 'other';
