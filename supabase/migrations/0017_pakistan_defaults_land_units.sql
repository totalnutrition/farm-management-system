-- =====================================================================
-- 0017 — Pakistan-centric defaults + granular land area unit
-- =====================================================================
-- - Adds `land_area_unit` enum and corresponding org default + location
--   override columns.
-- - Switches the DB defaults on organizations (currency/timezone/land
--   unit) to Pakistan-appropriate values so new orgs land sensibly.
-- - Existing rows are left untouched (admins update via the form).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'land_area_unit') then
    create type land_area_unit as enum (
      'hectare',
      'acre',
      'square_meter',
      'square_foot',
      'marla',
      'kanal',
      'murabba'
    );
  end if;
end$$;

alter table public.organizations
  add column if not exists default_land_area_unit land_area_unit not null default 'acre';

alter table public.locations
  add column if not exists land_area_unit_override land_area_unit;

-- New-row defaults (existing rows keep their values)
alter table public.organizations
  alter column default_currency set default 'PKR';
alter table public.organizations
  alter column default_timezone set default 'Asia/Karachi';
