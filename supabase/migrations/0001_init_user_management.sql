-- =====================================================================
-- 0001 — User management foundation: organizations, profiles, RLS
-- Run this in the Supabase SQL editor (or via supabase CLI).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Roles ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('super_admin', 'admin');
  end if;
end$$;

-- ---------- organizations ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null,
  organization_id uuid references public.organizations(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles(organization_id);
create index if not exists profiles_role_idx on public.profiles(role);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- JWT helpers (read role/org from app_metadata) ----------
create or replace function public.auth_role() returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', null);
$$;

create or replace function public.auth_org_id() returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'organization_id', '')::uuid;
$$;

-- ---------- RLS ----------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- organizations: super_admin sees/edits all; admin reads only own org
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select
  using (public.auth_role() = 'super_admin' or id = public.auth_org_id());

drop policy if exists organizations_modify on public.organizations;
create policy organizations_modify on public.organizations for all
  using (public.auth_role() = 'super_admin')
  with check (public.auth_role() = 'super_admin');

-- profiles: super_admin sees all; admin sees own org rows + own row
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    public.auth_role() = 'super_admin'
    or organization_id = public.auth_org_id()
    or id = auth.uid()
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (public.auth_role() = 'super_admin');

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.auth_role() = 'super_admin' or id = auth.uid())
  with check (public.auth_role() = 'super_admin' or id = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.auth_role() = 'super_admin');

-- =====================================================================
-- Bootstrap super admin
-- Promotes an existing auth user to super_admin (idempotent).
-- The auth user must already exist (created via Auth > Users).
-- =====================================================================
do $$
declare
  v_id uuid := '9c232235-ab51-4265-a191-3b80801e0628';
  v_email text;
begin
  select email into v_email from auth.users where id = v_id;
  if v_email is null then
    raise notice 'Auth user % not found — skipping super admin bootstrap.', v_id;
    return;
  end if;

  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('role', 'super_admin')
   where id = v_id;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (v_id, v_email, null, 'super_admin', true)
  on conflict (id) do update
    set role = 'super_admin',
        is_active = true,
        email = excluded.email;
end$$;
