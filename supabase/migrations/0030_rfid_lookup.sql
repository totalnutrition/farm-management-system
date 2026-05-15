-- ===================================================================
-- 0030_rfid_lookup.sql
-- RFID scanner support. animals.official_id already holds the ISO /
-- USDA-840 / CCIA tag number (the value an HID scanner emits). This
-- migration:
--   1. Adds a unique partial index on (location_id, official_id) so
--      a scanned tag maps to exactly one cow per location.
--   2. Adds a plain index on lower(official_id) for fast wedge-scan
--      lookup (scanners often append whitespace / mixed case).
-- ===================================================================

create unique index if not exists animals_loc_official_id_uidx
  on public.animals (location_id, official_id)
  where official_id is not null;

create index if not exists animals_official_id_idx
  on public.animals (official_id)
  where official_id is not null;

comment on column public.animals.official_id is
  'ISO 11784/11785 / USDA-840 / CCIA tag number. Scanners read this; '
  'we look animals up by it from the AnimalScanInput component.';
