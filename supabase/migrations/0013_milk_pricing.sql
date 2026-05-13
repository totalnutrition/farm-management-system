-- =====================================================================
-- 0013 — Milk pricing schemes (per location, effective-dated)
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'correction_method') then
    create type correction_method as enum (
      'raw', 'fcm_3.5', 'fcm_4', 'ecm_nrc', 'ecm_tr',
      'ms', 'ts', 'fat_corrected', 'snf_corrected', 'custom'
    );
  end if;
end$$;

create table if not exists public.milk_pricing_schemes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  template_id uuid references public.org_pricing_scheme_templates(id) on delete set null,
  name text not null,
  currency text not null,
  base_unit text not null,
  correction correction_method not null default 'raw',
  base_price_per_unit numeric(12, 4),
  component_bonuses jsonb not null default '{}'::jsonb,
  scc_tiers jsonb not null default '[]'::jsonb,
  volume_tiers jsonb not null default '[]'::jsonb,
  quality_bonus_flat numeric(10, 4),
  effective_from date not null,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists milk_pricing_schemes_loc_dates_idx
  on public.milk_pricing_schemes(location_id, effective_from desc);

drop trigger if exists milk_pricing_schemes_set_updated_at on public.milk_pricing_schemes;
create trigger milk_pricing_schemes_set_updated_at
  before update on public.milk_pricing_schemes
  for each row execute function public.set_updated_at();

alter table public.milk_pricing_schemes enable row level security;

drop policy if exists milk_pricing_schemes_select on public.milk_pricing_schemes;
create policy milk_pricing_schemes_select on public.milk_pricing_schemes for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists milk_pricing_schemes_write on public.milk_pricing_schemes;
create policy milk_pricing_schemes_write on public.milk_pricing_schemes for all
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

-- Helper: close any open scheme when a new one starts. Idempotent.
create or replace function public.close_overlapping_pricing_schemes()
returns trigger language plpgsql security definer as $$
begin
  update public.milk_pricing_schemes
     set effective_to = new.effective_from - interval '1 day',
         updated_at = now()
   where location_id = new.location_id
     and id <> new.id
     and effective_to is null
     and effective_from < new.effective_from;
  return new;
end$$;

drop trigger if exists milk_pricing_schemes_close_prev on public.milk_pricing_schemes;
create trigger milk_pricing_schemes_close_prev
  after insert on public.milk_pricing_schemes
  for each row execute function public.close_overlapping_pricing_schemes();
