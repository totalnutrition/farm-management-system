-- =====================================================================
-- 0025_delete_event_reversal.sql — Phase 0 (integrity). Deleting an
-- activity must also undo the stock it consumed. Auto stock-usage
-- events (214 SUSE) carry payload.src_event = the id of the
-- triggering treatment/breeding/feeding event. This function, under
-- the SAME per-org advisory lock as consume_supply, deletes those
-- linked usage events and then the primary event itself — so on-hand
-- snaps back atomically and can't race a concurrent consumption.
--
--   public.delete_event_with_reversal(p_org, p_event_id) -> jsonb
--     { "ok": true, "reversed": <n> }   or   { "ok": false }
--
-- Org-scoped: only deletes when the event belongs to p_org. Run
-- AFTER 0024. Idempotent (deleting an already-gone event -> ok:false).
-- =====================================================================

create or replace function public.delete_event_with_reversal(
  p_org      uuid,
  p_event_id uuid
) returns jsonb
language plpgsql
as $fn$
declare
  v_exists boolean;
  v_rev    integer := 0;
begin
  select exists(
    select 1 from public.events
    where id = p_event_id and organization_id = p_org
  ) into v_exists;
  if not v_exists then
    return jsonb_build_object('ok', false);
  end if;

  perform pg_advisory_xact_lock(hashtext(p_org::text || ':supply'));

  delete from public.events
  where organization_id = p_org
    and event_code = 214
    and payload->>'src_event' = p_event_id::text;
  get diagnostics v_rev = row_count;

  delete from public.events
  where id = p_event_id and organization_id = p_org;

  return jsonb_build_object('ok', true, 'reversed', v_rev);
end;
$fn$;
