-- =====================================================================
-- 0029_preg_check.sql — Seed PRCK (pregnancy check, code 4) per org.
-- The repro state machine has the PREG state (rc=5) defined but no
-- event to reach it — so Close-up vs Far-off never split correctly.
-- A positive PRCK transitions a BRED animal to PREG; a negative one
-- back to OPEN. Payload: { result: 'pos'|'neg', due_date? }. The
-- engine reads the latest positive PRCK's due_date to compute DUE
-- and stage close-up cows/heifers. Run AFTER 0028. Idempotent.
-- =====================================================================

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 4, 'PRCK', 'Preg check', false,
     'app-defined: pregnancy confirmation (positive/negative)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
