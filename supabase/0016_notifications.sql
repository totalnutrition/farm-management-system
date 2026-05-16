-- =====================================================================
-- 0016_notifications.sql — Phase 18. In-app notifications. A sweep
-- upserts drafts keyed by (org, dedupe_key) so repeated runs don't
-- duplicate; read state is preserved. Run AFTER 0015. No RLS;
-- anon/auth revoked, service_role only. Idempotent.
-- =====================================================================

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dedupe_key      text not null,
  category        text not null,
  severity        text not null check (severity in ('info','warn','alert')),
  title           text not null,
  body            text not null,
  link            text not null,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  unique (organization_id, dedupe_key)
);
create index if not exists notifications_org_idx
  on public.notifications(organization_id, created_at desc);

revoke all on public.notifications from anon, authenticated;
grant  all on public.notifications to service_role;
