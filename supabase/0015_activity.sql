-- =====================================================================
-- 0015_activity.sql — Phase 16b. Mark-for-activity is an event on the
-- animal (no new tables). Seeds the app-defined FLAG event code per
-- org. Run AFTER 0014. Idempotent.
-- =====================================================================

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 203, 'FLAG', 'Mark for activity', false,
     'app-defined: Activity (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
