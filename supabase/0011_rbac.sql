-- =====================================================================
-- 0011_rbac.sql — Phase 11c: expand roles + external scoped sharing.
-- Extends the user_role enum (NEVER rewrites it) and adds org_shares
-- for farm-granted external consultant access. Run AFTER 0010.
-- Idempotent. No RLS; anon/auth revoked, service_role only.
-- org_shares.role is TEXT (not the enum) deliberately, so this
-- migration never uses a just-added enum value in the same script.
-- =====================================================================

alter type user_role add value if not exists 'herdsman';
alter type user_role add value if not exists 'vet';
alter type user_role add value if not exists 'nutritionist';
alter type user_role add value if not exists 'feeder';
alter type user_role add value if not exists 'viewer';

create table if not exists public.org_shares (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            text not null default 'viewer'
                    check (role in ('vet','nutritionist','viewer')),
  scope           text not null default 'read'
                    check (scope in ('read','write')),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, email)
);
create index if not exists org_shares_org_idx
  on public.org_shares(organization_id);

revoke all on public.org_shares from anon, authenticated;
grant  all on public.org_shares to service_role;
