-- =====================================================================
-- 0013_health.sql — Phase 15. Drugs are `drug` SUBJECTS (extends the
-- subject_type enum; never rewrites it). A treatment is an event on
-- the animal carrying the computed withhold dates. Seeds the
-- app-defined TREAT event code per org. Run AFTER 0012. Idempotent.
-- The new enum value is NOT used elsewhere in this migration (events
-- seed only), so it is transaction-safe.
-- =====================================================================

alter type subject_type add value if not exists 'drug';

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 202, 'TREAT', 'Treatment (Health)', false,
     'app-defined: Health (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
