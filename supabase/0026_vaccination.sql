-- =====================================================================
-- 0026_vaccination.sql — Vaccination as a first-class clinical event.
-- VACC (204) mirrors TREAT (202): it carries the milk/meat
-- withhold-until dates computed at entry from the vaccine's Supply
-- item, so DNSHIP/DNSELL stay pure and food-safe. App-defined,
-- user range. Seed one code per org. Run AFTER 0025. Idempotent.
-- =====================================================================

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 204, 'VACC', 'Vaccination', false,
     'app-defined: Health (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
