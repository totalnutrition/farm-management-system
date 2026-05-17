-- =====================================================================
-- 0018_calculated_fields.sql — user-defined calculated fields.
-- A calculated field is a saved, named Google-Sheets-style formula
-- over existing items (and other calc fields). Stored as source text;
-- compiled + injected into the derive context at query time so it
-- behaves like any built-in item across Query / Grouping / Monitor /
-- Views / Reports. Same server-mediated access model as 0003_views.
-- Idempotent. Run AFTER 0003.
-- =====================================================================

create table if not exists public.calculated_fields (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key             text not null,             -- uppercase item code (e.g. RPD)
  label           text not null,
  expression      text not null,             -- Sheets formula source
  kind            text not null default 'num'
                    check (kind in ('num', 'flag', 'text')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, key)
);
create index if not exists calculated_fields_org_idx
  on public.calculated_fields(organization_id);

drop trigger if exists calculated_fields_set_updated_at
  on public.calculated_fields;
create trigger calculated_fields_set_updated_at
  before update on public.calculated_fields
  for each row execute function public.set_updated_at();

revoke all on public.calculated_fields from anon, authenticated;
grant  all on public.calculated_fields to service_role;
