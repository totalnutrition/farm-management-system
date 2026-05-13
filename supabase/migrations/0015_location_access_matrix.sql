-- =====================================================================
-- 0015 — Location user access with per-section permission matrix
-- =====================================================================
-- Supersedes the flat location_members table from 0003. A user can be
-- granted "view" or "edit" per Settings section on a per-location
-- basis. Admin role on the org still implies full access.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'access_level') then
    create type access_level as enum ('none', 'view', 'edit');
  end if;
end$$;

create table if not exists public.location_user_access (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Default access level applied when no per-section row overrides
  default_access access_level not null default 'view',
  -- Optional per-section overrides as jsonb: { recording: 'edit', groups: 'view', ... }
  section_access jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, user_id)
);

create index if not exists location_user_access_user_idx
  on public.location_user_access(user_id);

drop trigger if exists location_user_access_set_updated_at on public.location_user_access;
create trigger location_user_access_set_updated_at
  before update on public.location_user_access
  for each row execute function public.set_updated_at();

alter table public.location_user_access enable row level security;

drop policy if exists location_user_access_select on public.location_user_access;
create policy location_user_access_select on public.location_user_access for select
  using (
    public.auth_role() = 'super_admin'
    or user_id = auth.uid()
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
        and public.auth_role() = 'admin'
    )
  );

drop policy if exists location_user_access_write on public.location_user_access;
create policy location_user_access_write on public.location_user_access for all
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
