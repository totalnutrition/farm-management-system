-- =====================================================================
-- 0016 — Per-location people directories
-- =====================================================================
-- Technicians, veterinarians, hoof trimmers, nutritionists, and other
-- people referenced by events at this location. Future events
-- (repro_events.technician, health_events.prescribing_vet, etc.) can
-- optionally FK into this table; for now it's a freestanding directory.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'directory_role') then
    create type directory_role as enum (
      'technician', 'veterinarian', 'hoof_trimmer', 'nutritionist',
      'inseminator', 'consultant', 'other'
    );
  end if;
end$$;

create table if not exists public.location_directory (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  role directory_role not null,
  full_name text not null,
  organization_name text,
  email text,
  phone text,
  external_id text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists location_directory_loc_role_idx
  on public.location_directory(location_id, role);

drop trigger if exists location_directory_set_updated_at on public.location_directory;
create trigger location_directory_set_updated_at
  before update on public.location_directory
  for each row execute function public.set_updated_at();

alter table public.location_directory enable row level security;

drop policy if exists location_directory_select on public.location_directory;
create policy location_directory_select on public.location_directory for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists location_directory_write on public.location_directory;
create policy location_directory_write on public.location_directory for all
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
