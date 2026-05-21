-- =====================================================================
-- 0030_event_cancellation.sql — Append-only-correct event reversal.
-- The events_block_mutation trigger (mig. 0002) raises
-- "events is append-only: DELETE is not permitted (record corrections
-- as new events)" — which makes 0025's delete_event_with_reversal
-- error in production. Replace it with reverse_event() which never
-- deletes; it INSERTs:
--   • a CNCL marker on the primary event (payload.cancels = orig id);
--   • a compensating SRCV (210) for each linked SUSE (214) so the
--     supply ledger rebalances by the normal signed-qty rule (no
--     filtering required on the stock side).
-- The UI hides cancelled events from active timelines by skipping
-- any event whose id is referenced by a CNCL row. Run AFTER 0029.
-- Idempotent (CREATE OR REPLACE / ON CONFLICT).
-- =====================================================================

-- 1. Seed CNCL (209) per org.
do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 209, 'CNCL', 'Cancelled', false,
     'app-defined: marks a prior event cancelled (payload.cancels)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;

-- 2. Drop the broken delete-based RPC.
drop function if exists public.delete_event_with_reversal(uuid, uuid);

-- 3. reverse_event(p_org, p_event_id) — appends a CNCL marker and,
--    for every linked auto-stock-usage event, a compensating receipt.
create or replace function public.reverse_event(
  p_org      uuid,
  p_event_id uuid
) returns jsonb
language plpgsql
as $fn$
declare
  v_orig   public.events%rowtype;
  v_usage  public.events%rowtype;
  v_rev    integer := 0;
begin
  select * into v_orig from public.events
   where id = p_event_id and organization_id = p_org;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  -- Serialise against concurrent stock consumption for this org
  -- (same lock key as consume_supply in 0024).
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':supply'));

  -- For every linked auto-stock-usage event (214 SUSE,
  -- payload.src_event = original), append a compensating 210 SRCV
  -- so the ledger rebalances. Tag with reverses_event for audit.
  for v_usage in
    select * from public.events
     where organization_id = p_org
       and event_code = 214
       and payload->>'src_event' = p_event_id::text
  loop
    insert into public.events
      (organization_id, subject_id, event_code, event_date, payload,
       source, created_by)
    values
      (p_org, v_usage.subject_id, 210, current_date,
       jsonb_build_object(
         'qty', (v_usage.payload->>'qty')::numeric,
         'reverses_event', v_usage.id,
         'note', 'auto-reversal'
       ),
       'system', v_orig.created_by);
    v_rev := v_rev + 1;
  end loop;

  -- Append the CNCL marker on the primary event.
  insert into public.events
    (organization_id, subject_id, event_code, event_date, payload,
     source, created_by)
  values
    (p_org, v_orig.subject_id, 209, current_date,
     jsonb_build_object(
       'cancels', p_event_id,
       'orig_event_code', v_orig.event_code,
       'orig_event_date', v_orig.event_date
     ),
     'system', v_orig.created_by);

  return jsonb_build_object('ok', true, 'reversed', v_rev);
end;
$fn$;
