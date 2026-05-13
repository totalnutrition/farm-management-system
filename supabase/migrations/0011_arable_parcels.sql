-- =====================================================================
-- 0011 — Arable parcels (crop module foundation)
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parcel_status') then
    create type parcel_status as enum ('active', 'fallow', 'archived');
  end if;
end$$;

create table if not exists public.arable_parcels (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  parcel_code text,
  area_hectares numeric(10, 2),
  status parcel_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists arable_parcels_location_idx on public.arable_parcels(location_id);

drop trigger if exists arable_parcels_set_updated_at on public.arable_parcels;
create trigger arable_parcels_set_updated_at
  before update on public.arable_parcels
  for each row execute function public.set_updated_at();

alter table public.arable_parcels enable row level security;

drop policy if exists arable_parcels_select on public.arable_parcels;
create policy arable_parcels_select on public.arable_parcels for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists arable_parcels_write on public.arable_parcels;
create policy arable_parcels_write on public.arable_parcels for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  );
