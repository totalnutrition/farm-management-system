-- =====================================================================
-- 0028_weigh.sql — Seed the WEIGH event code (205) per organization so
-- weighings can be recorded uniformly. Mirrors 0026 (VACC): an app-
-- defined user-range event, not a DC code. Run AFTER 0027. Idempotent.
-- =====================================================================

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 205, 'WEIGH', 'Weighing', false,
     'app-defined: growth (animal body weight reading)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
