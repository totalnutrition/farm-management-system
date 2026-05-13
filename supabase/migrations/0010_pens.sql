-- =====================================================================
-- 0010 — Pens (industry-standard pen-type taxonomy)
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pen_type') then
    create type pen_type as enum (
      'milking', 'dry', 'close_up', 'far_off', 'fresh',
      'hospital', 'maternity', 'AI_breeding', 'bull',
      'heifer', 'calf', 'other'
    );
  end if;
end$$;

create table if not exists public.pens (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  barn_id uuid references public.barns(id) on delete set null,
  group_id uuid references public.location_groups(id) on delete set null,
  name text not null,
  pen_code text,
  type pen_type not null default 'milking',
  capacity_head int,
  -- Pen-type side-effect flags
  is_AI_pen boolean not null default false,
  is_BULL_pen boolean not null default false,
  is_DRY_pen boolean not null default false,
  is_HOSP_pen boolean not null default false,
  is_FRESH_pen boolean not null default false,
  is_placeholder boolean not null default false,
  tmr_recipe_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name),
  constraint pens_ai_bull_exclusive check (not (is_AI_pen and is_BULL_pen))
);

create index if not exists pens_location_idx on public.pens(location_id);
create index if not exists pens_barn_idx on public.pens(barn_id);
create index if not exists pens_group_idx on public.pens(group_id);

drop trigger if exists pens_set_updated_at on public.pens;
create trigger pens_set_updated_at
  before update on public.pens
  for each row execute function public.set_updated_at();

alter table public.pens enable row level security;

drop policy if exists pens_select on public.pens;
create policy pens_select on public.pens for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id
        and l.organization_id = public.auth_org_id()
    )
  );

drop policy if exists pens_write on public.pens;
create policy pens_write on public.pens for all
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
