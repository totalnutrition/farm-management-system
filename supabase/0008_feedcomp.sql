-- =====================================================================
-- 0008_feedcomp.sql — Phase 10 (independence proof). FeedComp adds NO
-- new core tables: rations are `ration` SUBJECTS and feeding is an
-- event on the `pen` subject in the EXISTING ledger. This migration
-- only seeds the app-defined FEED event code (user range, NON-system,
-- provenance-tagged) per org so the events FK is satisfied. Run AFTER
-- 0007. Idempotent.
-- =====================================================================

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 200, 'FEED', 'Pen feeding (FeedComp)', false,
     'app-defined: FeedComp (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
