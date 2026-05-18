-- =====================================================================
-- 0021_supply_party.sql — Phase 21. Supply Chain: parties & sales.
-- One PARTY (`supply_party` subject) carries roles supplier and/or
-- buyer + contact/terms — replaces the separate Commercial vendor /
-- customer registration. A purchase is a 210 SRCV receipt from a
-- supplier; a sale is a new 215 SSAL issue to a buyer. Commercial's
-- buy/sell is absorbed by Supply Chain (its nav link is removed).
-- Extends the subject_type enum (never rewrites); the new value is
-- NOT used in this migration (parties are created lazily by the
-- action), so it is transaction-safe. Run AFTER 0020. Idempotent.
-- =====================================================================

alter type subject_type add value if not exists 'supply_party';

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 215, 'SSAL', 'Stock sale (Supply Chain)', false,
     'app-defined: Supply Chain (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
