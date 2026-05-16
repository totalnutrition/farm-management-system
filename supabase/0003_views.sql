-- =====================================================================
-- 0003_views.sql — Phase 5: saved Views (named, reusable queries).
-- A View is just a stored Query IR with a name. Run AFTER 0002.
-- Same access model as 0002: no RLS; revoked from anon/authenticated,
-- granted only to service_role (server-mediated). Idempotent.
-- =====================================================================

create table if not exists public.views (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  query           jsonb not null,            -- the Query IR (lib/derive/query)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, name)
);
create index if not exists views_org_idx on public.views(organization_id);

drop trigger if exists views_set_updated_at on public.views;
create trigger views_set_updated_at before update on public.views
  for each row execute function public.set_updated_at();

revoke all on public.views from anon, authenticated;
grant  all on public.views to service_role;
