-- =====================================================================
-- 0004 — Wizard state, module toggles, and area capture on Locations
-- =====================================================================

-- ---------- setup_step enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'location_setup_step') then
    create type location_setup_step as enum (
      'identity',
      'recording',
      'import_choice',
      'import',
      'herd_profile',
      'group_strategy',
      'rules',
      'capacity_plan',
      'barns',
      'pens',
      'arable_parcels',
      'done'
    );
  end if;
end$$;

-- ---------- new columns on locations ----------
alter table public.locations
  add column if not exists manages_livestock boolean not null default true,
  add column if not exists manages_crops boolean not null default false,
  add column if not exists livestock_area_hectares numeric(10, 2),
  add column if not exists arable_area_hectares numeric(10, 2),
  add column if not exists timezone text,
  add column if not exists setup_step location_setup_step not null default 'identity',
  add column if not exists setup_completed_at timestamptz;

-- Existing rows created before this migration get setup_completed_at = now()
-- so they don't suddenly show an onboarding banner. New rows start at 'identity'.
update public.locations
   set setup_step = 'done',
       setup_completed_at = coalesce(setup_completed_at, now())
 where setup_completed_at is null
   and created_at < now() - interval '1 minute';
