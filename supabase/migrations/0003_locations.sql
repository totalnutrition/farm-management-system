-- =====================================================================
-- 0003 — Locations: per-organization farm sites with a kind enum.
-- Initially only `dairy` and `mixed` are surfaced as selectable; other
-- kinds are blurred in the UI but accepted by the schema so we can
-- enable them later without a migration.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'location_kind') then
    create type location_kind as enum (
      'dairy',
      'beef',
      'poultry',
      'small_ruminants',
      'mixed',
      'other'
    );
  end if;
end$$;

create table if not exists public.locations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  kind            location_kind not null,
  address         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists locations_organization_id_idx on public.locations(organization_id);
create index if not exists locations_kind_idx on public.locations(kind);

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

alter table public.locations enable row level security;

drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select
  using (
    public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );

drop policy if exists locations_insert on public.locations;
create policy locations_insert on public.locations for insert
  with check (
    public.auth_role() = 'super_admin'
    or (
      public.auth_role() = 'admin'
      and organization_id = public.auth_org_id()
    )
  );

drop policy if exists locations_update on public.locations;
create policy locations_update on public.locations for update
  using (
    public.auth_role() = 'super_admin'
    or (
      public.auth_role() = 'admin'
      and organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or (
      public.auth_role() = 'admin'
      and organization_id = public.auth_org_id()
    )
  );

drop policy if exists locations_delete on public.locations;
create policy locations_delete on public.locations for delete
  using (
    public.auth_role() = 'super_admin'
    or (
      public.auth_role() = 'admin'
      and organization_id = public.auth_org_id()
    )
  );
