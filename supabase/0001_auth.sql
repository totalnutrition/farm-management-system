-- =====================================================================
-- 0001_auth.sql — minimal auth/tenancy base for the clean shell.
-- Run AFTER wipe.sql. No farm domain yet — that gets built fresh,
-- Bovisync-style. Ends by promoting every existing login to
-- super_admin and attaching them to a default org, so you can log in
-- and see the app with no UUID editing. Re-runnable.
-- =====================================================================

create extension if not exists "pgcrypto";

create type user_role as enum ('super_admin', 'admin');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null,
  organization_id uuid references public.organizations(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx  on public.profiles(organization_id);
create index profiles_role_idx on public.profiles(role);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.auth_role() returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', null); $$;
create function public.auth_org_id() returns uuid language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'organization_id', '')::uuid; $$;

alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;

create policy organizations_select on public.organizations for select
  using (public.auth_role()='super_admin' or id=public.auth_org_id());
create policy organizations_modify on public.organizations for all
  using (public.auth_role()='super_admin') with check (public.auth_role()='super_admin');

create policy profiles_select on public.profiles for select
  using (public.auth_role()='super_admin' or organization_id=public.auth_org_id() or id=auth.uid());
create policy profiles_insert on public.profiles for insert
  with check (public.auth_role()='super_admin');
create policy profiles_update on public.profiles for update
  using (public.auth_role()='super_admin' or id=auth.uid())
  with check (public.auth_role()='super_admin' or id=auth.uid());
create policy profiles_delete on public.profiles for delete
  using (public.auth_role()='super_admin');

-- Bootstrap: one org, every existing login → super_admin on it.
do $$
declare v_org uuid;
begin
  insert into public.organizations (name) values ('My Farm') returning id into v_org;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
         || jsonb_build_object('role','super_admin','organization_id',v_org::text);

  insert into public.profiles (id, email, full_name, role, organization_id, is_active)
  select id, email, null, 'super_admin', v_org, true from auth.users
  on conflict (id) do update
    set role='super_admin', is_active=true, organization_id=excluded.organization_id;

  raise notice 'Auth ready. Org %, all logins promoted to super_admin.', v_org;
end$$;
