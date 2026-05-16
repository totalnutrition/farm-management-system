-- =====================================================================
-- 0017_commercial.sql — Phase 19. Vendors & customers are SUBJECTS;
-- a per-org BOOKS ledger subject holds SALE/PURCHASE events. Extends
-- the subject_type enum (never rewrites). The new enum values are NOT
-- used in this migration (the BOOKS subject is created lazily by the
-- action), so it is transaction-safe. Run AFTER 0016. Idempotent.
-- =====================================================================

alter type subject_type add value if not exists 'vendor';
alter type subject_type add value if not exists 'customer';
alter type subject_type add value if not exists 'ledger';

do $seed$
declare org record;
begin
for org in select id from public.organizations loop
  insert into public.event_codes
    (organization_id, code, name, label, is_system, provenance)
  values
    (org.id, 204, 'SALE', 'Sale (Commercial)', false,
     'app-defined: Commercial (user-range event, not a DC code)'),
    (org.id, 205, 'BUY', 'Purchase (Commercial)', false,
     'app-defined: Commercial (user-range event, not a DC code)')
  on conflict (organization_id, code) do nothing;
end loop;
end $seed$;
