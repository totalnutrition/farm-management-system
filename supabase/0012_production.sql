-- =====================================================================
-- 0012_production.sql — Phase 13. Milking is an EVENT on the animal in
-- the existing ledger (no new core tables). Seeds the app-defined
-- MILK event code (user range, NON-system, provenance-tagged) per org
-- so the events FK is satisfied. Run AFTER 0011. Idempotent.
-- =====================================================================

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 201, 'MILK', 'Milking (Production)', false,
     'app-defined: Production (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
