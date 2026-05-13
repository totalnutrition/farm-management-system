-- =====================================================================
-- 0003 — Locations (per-organization farms) and per-user access
-- =====================================================================

-- ---------- farm_type ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'farm_type') then
    create type farm_type as enum ('dairy', 'sheep_goat', 'poultry', 'other');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'location_status') then
    create type location_status as enum ('active', 'archived');
  end if;
end$$;

-- ---------- locations ----------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  short_code text not null,
  farm_type farm_type not null default 'dairy',
  country text,
  province text,
  city text,
  address text,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  status location_status not null default 'active',
  units_weight text not null default 'kg',
  units_milk text not null default 'L',
  units_temp text not null default 'C',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, short_code)
);

create index if not exists locations_organization_id_idx
  on public.locations(organization_id);

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- ---------- location_members ----------
-- Admins implicitly have access to every location in their org and do
-- NOT need rows here. This table only records explicit grants for
-- non-admin users.
create table if not exists public.location_members (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

create index if not exists location_members_user_id_idx
  on public.location_members(user_id);

-- ---------- RLS ----------
alter table public.locations enable row level security;
alter table public.location_members enable row level security;

-- locations: super_admin sees all; org users see locations of their org
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select
  using (
    public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
  );

-- only super_admin and admin (of that org) may insert/update/delete.
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

-- location_members: super_admin or org admin manages; user sees own grants
drop policy if exists location_members_select on public.location_members;
create policy location_members_select on public.location_members for select
  using (
    public.auth_role() = 'super_admin'
    or user_id = auth.uid()
    or exists (
      select 1 from public.locations l
      where l.id = location_members.location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  );

drop policy if exists location_members_modify on public.location_members;
create policy location_members_modify on public.location_members for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_members.location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_members.location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  );

-- ---------- helper: list location ids the current user may access ----------
create or replace function public.user_accessible_location_ids()
returns setof uuid language sql stable as $$
  select id from public.locations
  where public.auth_role() = 'super_admin'
     or (
       organization_id = public.auth_org_id()
       and (
         public.auth_role() = 'admin'
         or exists (
           select 1 from public.location_members lm
           where lm.location_id = locations.id
             and lm.user_id = auth.uid()
         )
       )
     );
$$;
