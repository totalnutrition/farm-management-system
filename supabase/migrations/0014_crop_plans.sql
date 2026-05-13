-- =====================================================================
-- 0014 — Crop plans + crop events on arable parcels
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crop_plan_status') then
    create type crop_plan_status as enum ('planned', 'in_progress', 'harvested', 'failed', 'archived');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'crop_event_type') then
    create type crop_event_type as enum (
      'planting', 'irrigation', 'fertilization', 'spray',
      'scouting', 'harvest', 'residue_management', 'other'
    );
  end if;
end$$;

create table if not exists public.crop_plans (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references public.arable_parcels(id) on delete cascade,
  crop_type text not null,
  variety text,
  planted_at date,
  planned_harvest_at date,
  status crop_plan_status not null default 'planned',
  expected_yield_kg_per_ha numeric(10, 1),
  actual_yield_kg_per_ha numeric(10, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crop_plans_parcel_idx on public.crop_plans(parcel_id);

drop trigger if exists crop_plans_set_updated_at on public.crop_plans;
create trigger crop_plans_set_updated_at
  before update on public.crop_plans
  for each row execute function public.set_updated_at();

create table if not exists public.crop_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.crop_plans(id) on delete cascade,
  event_date date not null,
  event_type crop_event_type not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crop_events_plan_date_idx
  on public.crop_events(plan_id, event_date desc);

alter table public.crop_plans enable row level security;
alter table public.crop_events enable row level security;

drop policy if exists crop_plans_select on public.crop_plans;
create policy crop_plans_select on public.crop_plans for select using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.arable_parcels p
    join public.locations l on l.id = p.location_id
    where p.id = parcel_id and l.organization_id = public.auth_org_id()
  )
);
drop policy if exists crop_plans_write on public.crop_plans;
create policy crop_plans_write on public.crop_plans for all using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.arable_parcels p
    join public.locations l on l.id = p.location_id
    where p.id = parcel_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
) with check (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.arable_parcels p
    join public.locations l on l.id = p.location_id
    where p.id = parcel_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
);

drop policy if exists crop_events_select on public.crop_events;
create policy crop_events_select on public.crop_events for select using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.crop_plans cp
    join public.arable_parcels p on p.id = cp.parcel_id
    join public.locations l on l.id = p.location_id
    where cp.id = plan_id and l.organization_id = public.auth_org_id()
  )
);
drop policy if exists crop_events_write on public.crop_events;
create policy crop_events_write on public.crop_events for all using (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.crop_plans cp
    join public.arable_parcels p on p.id = cp.parcel_id
    join public.locations l on l.id = p.location_id
    where cp.id = plan_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
) with check (
  public.auth_role() = 'super_admin'
  or exists (
    select 1 from public.crop_plans cp
    join public.arable_parcels p on p.id = cp.parcel_id
    join public.locations l on l.id = p.location_id
    where cp.id = plan_id
      and l.organization_id = public.auth_org_id()
      and public.auth_role() = 'admin'
  )
);
