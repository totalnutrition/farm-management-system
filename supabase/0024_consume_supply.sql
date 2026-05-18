-- =====================================================================
-- 0024_consume_supply.sql — Phase 0 (integrity). Atomic, race-safe
-- stock consumption. The app previously did check-then-insert with
-- no lock, so two concurrent stock-consuming entries could both pass
-- the negative guard and drive on-hand below zero.
--
-- public.consume_supply(org, needs, date, ref):
--   * takes a per-org transaction advisory lock (serialises all
--     stock consumption for the org for the duration of the txn),
--   * recomputes each item's on-hand from its movement ledger using
--     the SAME signed-qty rule as lib/supply.ts (receive/adjust +,
--     usage/sale -, price 0),
--   * if any item is short → returns the shortage list and writes
--     NOTHING,
--   * otherwise inserts one 214 SUSE usage event per item and
--     returns {"ok": true}.
--
-- `needs` is a jsonb array: [{"item_id": uuid, "qty": number}, ...].
-- Idempotency is the caller's concern (it deletes the primary event
-- and retries on shortage). Run AFTER 0023. Safe to re-run (CREATE
-- OR REPLACE).
-- =====================================================================

create or replace function public.consume_supply(
  p_org   uuid,
  p_needs jsonb,
  p_date  date,
  p_ref   jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
as $fn$
declare
  rec        record;
  v_onhand   numeric;
  v_short    jsonb := '[]'::jsonb;
begin
  if p_needs is null or jsonb_array_length(p_needs) = 0 then
    return jsonb_build_object('ok', true);
  end if;

  -- Serialise every stock consumption for this org. Held until the
  -- surrounding transaction (this function call) ends.
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':supply'));

  -- The SUSE code must exist for the events FK.
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (p_org, 214, 'SUSE', 'Stock usage (Supply Chain)', false,
     'app-defined: Supply Chain')
  on conflict (organization_id, code) do nothing;

  -- Aggregate duplicate item_ids in the request, then check each.
  for rec in
    select (n->>'item_id')::uuid as item_id,
           sum((n->>'qty')::numeric) as qty
    from jsonb_array_elements(p_needs) n
    group by (n->>'item_id')::uuid
  loop
    if rec.qty is null or rec.qty <= 0 then
      continue;
    end if;

    select coalesce(sum(
      case
        when e.event_code = 210 then abs((e.payload->>'qty')::numeric)
        when e.event_code in (214, 215)
          then -abs((e.payload->>'qty')::numeric)
        when e.event_code = 212 then (e.payload->>'qty')::numeric
        else 0
      end), 0)
    into v_onhand
    from public.events e
    where e.organization_id = p_org
      and e.subject_id = rec.item_id
      and e.event_code in (210, 212, 213, 214, 215)
      and (e.payload->>'qty') is not null;

    if v_onhand < rec.qty then
      v_short := v_short || jsonb_build_object(
        'item_id', rec.item_id,
        'need', rec.qty,
        'have', v_onhand
      );
    end if;
  end loop;

  if jsonb_array_length(v_short) > 0 then
    return jsonb_build_object('ok', false, 'shortages', v_short);
  end if;

  -- Sufficient: post the usage events (aggregated per item).
  insert into public.events
    (organization_id, subject_id, event_code, event_date,
     payload, source)
  select p_org, (n->>'item_id')::uuid, 214, p_date,
         jsonb_build_object(
           'qty', sum((n->>'qty')::numeric),
           'unit_cost', null,
           'party', null,
           'auto', true
         ) || coalesce(p_ref, '{}'::jsonb),
         'system'
  from jsonb_array_elements(p_needs) n
  group by (n->>'item_id')::uuid;

  return jsonb_build_object('ok', true);
end;
$fn$;
