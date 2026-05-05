-- =====================================================================
-- 0002 — Add address to organizations
-- =====================================================================

alter table public.organizations
  add column if not exists address text;
