-- ===================================================================
-- 0021_inventory_hr_events.sql
-- Stock ledger + per-domain event tables + HR (workers/attendance/payroll).
--
-- Adds the plumbing that lets operational events deduct inventory:
--   feeding event  →  stock_movements (kind=consumption) against feed line
--   vaccination    →  stock_movements against vet medicine line
--   breeding (AI)  →  stock_movements against semen straw line
--   procurement    →  stock_movements (kind=receipt) against any line
--
-- stock_items.on_hand_qty is maintained by trigger on stock_movements.
-- ===================================================================

-- -------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------
do $$ begin
  create type public.stock_item_kind as enum (
    'feed_material',
    'vet_medicine',
    'semen_straw',
    'consumable',
    'equipment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stock_movement_kind as enum (
    'opening',
    'receipt',
    'consumption',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'wastage'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.wage_period as enum ('daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'leave', 'half_day');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payroll_status as enum ('draft', 'posted', 'paid');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------
-- stock_items — one line per (location, kind, item_ref)
-- -------------------------------------------------------------------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  kind public.stock_item_kind not null,
  -- Optional FK to a catalog row; only one of these is set per row.
  feed_material_id   uuid references public.org_feed_materials(id)   on delete set null,
  vet_medicine_id    uuid references public.org_vet_medicines(id)    on delete set null,
  -- Free-form display label (denorm for fast list rendering + supports custom items)
  display_name text not null,
  unit text not null,                            -- 'kg' / 'L' / 'dose' / 'mL' / 'each'
  on_hand_qty numeric(14, 3) not null default 0,
  reorder_level numeric(14, 3),
  unit_cost_current numeric(14, 4),              -- moving-average or last receipt
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A given catalog item collapses to one line per location.
  unique (location_id, kind, feed_material_id, vet_medicine_id, display_name)
);

create index if not exists stock_items_location_kind_idx
  on public.stock_items(location_id, kind);

drop trigger if exists stock_items_set_updated_at on public.stock_items;
create trigger stock_items_set_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

alter table public.stock_items enable row level security;
drop policy if exists stock_items_select on public.stock_items;
create policy stock_items_select on public.stock_items for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists stock_items_write on public.stock_items;
create policy stock_items_write on public.stock_items for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- stock_movements — signed ledger; source of truth
-- -------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  kind public.stock_movement_kind not null,
  qty_delta numeric(14, 3) not null,             -- signed; receipts +, consumption -
  unit_cost numeric(14, 4),
  occurred_at timestamptz not null default now(),
  source_table text,                             -- e.g. 'feed_events', 'vaccination_events'
  source_id uuid,                                -- FK to the originating event row
  vendor_id uuid references public.location_suppliers(id) on delete set null,
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_item_at_idx
  on public.stock_movements(stock_item_id, occurred_at desc);
create index if not exists stock_movements_source_idx
  on public.stock_movements(source_table, source_id);

alter table public.stock_movements enable row level security;
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.stock_items si
      join public.locations l on l.id = si.location_id
      where si.id = stock_item_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists stock_movements_write on public.stock_movements;
create policy stock_movements_write on public.stock_movements for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.stock_items si
      join public.locations l on l.id = si.location_id
      where si.id = stock_item_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.stock_items si
      join public.locations l on l.id = si.location_id
      where si.id = stock_item_id and l.organization_id = public.auth_org_id()
    )
  );

-- Maintain stock_items.on_hand_qty from movements.
create or replace function public.stock_movements_apply()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.stock_items
       set on_hand_qty = on_hand_qty + new.qty_delta,
           unit_cost_current = case
             when new.kind = 'receipt' and new.unit_cost is not null then new.unit_cost
             else unit_cost_current
           end
     where id = new.stock_item_id;
  elsif tg_op = 'DELETE' then
    update public.stock_items
       set on_hand_qty = on_hand_qty - old.qty_delta
     where id = old.stock_item_id;
  elsif tg_op = 'UPDATE' then
    update public.stock_items
       set on_hand_qty = on_hand_qty - old.qty_delta + new.qty_delta
     where id = new.stock_item_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists stock_movements_apply_trg on public.stock_movements;
create trigger stock_movements_apply_trg
  after insert or update or delete on public.stock_movements
  for each row execute function public.stock_movements_apply();

-- -------------------------------------------------------------------
-- semen_straws — per-location sire dose inventory
-- -------------------------------------------------------------------
create table if not exists public.semen_straws (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  naab text not null,                            -- e.g. '014HO07419'
  sire_name text,
  breed_code text,
  lot text,
  tank_position text,                            -- e.g. 'Tank-1 / Cane-3 / Goblet-A'
  vendor_id uuid references public.location_suppliers(id) on delete set null,
  -- Doses bookkeeping mirrors stock_items ledger for consistency.
  stock_item_id uuid references public.stock_items(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, naab, lot)
);

create index if not exists semen_straws_location_naab_idx
  on public.semen_straws(location_id, naab);

drop trigger if exists semen_straws_set_updated_at on public.semen_straws;
create trigger semen_straws_set_updated_at
  before update on public.semen_straws
  for each row execute function public.set_updated_at();

alter table public.semen_straws enable row level security;
drop policy if exists semen_straws_select on public.semen_straws;
create policy semen_straws_select on public.semen_straws for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists semen_straws_write on public.semen_straws;
create policy semen_straws_write on public.semen_straws for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- feed_events — group/pen-level feeding deliveries
-- -------------------------------------------------------------------
create table if not exists public.feed_events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  group_id uuid references public.location_groups(id) on delete set null,
  pen_id uuid references public.pens(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  as_fed_kg numeric(12, 2) not null,
  dm_kg numeric(12, 2),
  occurred_at timestamptz not null default now(),
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feed_events_location_at_idx
  on public.feed_events(location_id, occurred_at desc);
create index if not exists feed_events_group_idx
  on public.feed_events(group_id, occurred_at desc);

alter table public.feed_events enable row level security;
drop policy if exists feed_events_select on public.feed_events;
create policy feed_events_select on public.feed_events for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists feed_events_write on public.feed_events;
create policy feed_events_write on public.feed_events for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- feed_refusals — leftover (orts) tied to a feeding event
-- -------------------------------------------------------------------
create table if not exists public.feed_refusals (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  group_id uuid references public.location_groups(id) on delete set null,
  pen_id uuid references public.pens(id) on delete set null,
  feed_event_id uuid references public.feed_events(id) on delete set null,
  refusal_kg numeric(12, 2) not null,
  occurred_at timestamptz not null default now(),
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feed_refusals_location_at_idx
  on public.feed_refusals(location_id, occurred_at desc);

alter table public.feed_refusals enable row level security;
drop policy if exists feed_refusals_select on public.feed_refusals;
create policy feed_refusals_select on public.feed_refusals for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists feed_refusals_write on public.feed_refusals;
create policy feed_refusals_write on public.feed_refusals for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- vaccination_events — per-animal or per-group jab
-- -------------------------------------------------------------------
create table if not exists public.vaccination_events (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  animal_id uuid references public.animals(id) on delete cascade,
  group_id uuid references public.location_groups(id) on delete set null,
  vaccination_protocol_id uuid references public.org_vaccination_protocols(id) on delete set null,
  vet_medicine_id uuid references public.org_vet_medicines(id) on delete set null,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  dose_ml numeric(8, 2),
  route text,
  occurred_at timestamptz not null default now(),
  withdrawal_milk_until timestamptz,
  withdrawal_meat_until date,
  operator_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  check (animal_id is not null or group_id is not null)
);

create index if not exists vaccination_events_animal_at_idx
  on public.vaccination_events(animal_id, occurred_at desc);
create index if not exists vaccination_events_location_at_idx
  on public.vaccination_events(location_id, occurred_at desc);

alter table public.vaccination_events enable row level security;
drop policy if exists vaccination_events_select on public.vaccination_events;
create policy vaccination_events_select on public.vaccination_events for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists vaccination_events_write on public.vaccination_events;
create policy vaccination_events_write on public.vaccination_events for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- workers — staff roster per location (not necessarily app users)
-- -------------------------------------------------------------------
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  national_id text,
  phone text,
  role text,                                     -- 'milker' / 'feeder' / 'AI tech' / 'manager' / …
  hire_date date,
  end_date date,
  base_wage_amount numeric(12, 2),
  wage_period public.wage_period default 'monthly',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workers_location_idx on public.workers(location_id);

drop trigger if exists workers_set_updated_at on public.workers;
create trigger workers_set_updated_at
  before update on public.workers
  for each row execute function public.set_updated_at();

alter table public.workers enable row level security;
drop policy if exists workers_select on public.workers;
create policy workers_select on public.workers for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists workers_write on public.workers;
create policy workers_write on public.workers for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- attendance_events
-- -------------------------------------------------------------------
create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  occurred_date date not null,
  status public.attendance_status not null default 'present',
  hours_worked numeric(5, 2),
  shift text,                                    -- 'morning' / 'evening' / 'night'
  note text,
  created_at timestamptz not null default now(),
  unique (worker_id, occurred_date, shift)
);

create index if not exists attendance_events_worker_idx
  on public.attendance_events(worker_id, occurred_date desc);

alter table public.attendance_events enable row level security;
drop policy if exists attendance_events_select on public.attendance_events;
create policy attendance_events_select on public.attendance_events for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.workers w
      join public.locations l on l.id = w.location_id
      where w.id = worker_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists attendance_events_write on public.attendance_events;
create policy attendance_events_write on public.attendance_events for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.workers w
      join public.locations l on l.id = w.location_id
      where w.id = worker_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.workers w
      join public.locations l on l.id = w.location_id
      where w.id = worker_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- payroll_runs + payroll_lines
-- -------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status public.payroll_status not null default 'draft',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists payroll_runs_location_idx
  on public.payroll_runs(location_id, period_end desc);

drop trigger if exists payroll_runs_set_updated_at on public.payroll_runs;
create trigger payroll_runs_set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

alter table public.payroll_runs enable row level security;
drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists payroll_runs_write on public.payroll_runs;
create policy payroll_runs_write on public.payroll_runs for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete restrict,
  days_present numeric(5, 2),
  hours_worked numeric(7, 2),
  gross_amount numeric(14, 2) not null default 0,
  deductions_amount numeric(14, 2) not null default 0,
  advances_amount numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) generated always as
    (gross_amount - deductions_amount - advances_amount) stored,
  note text,
  created_at timestamptz not null default now(),
  unique (payroll_run_id, worker_id)
);

alter table public.payroll_lines enable row level security;
drop policy if exists payroll_lines_select on public.payroll_lines;
create policy payroll_lines_select on public.payroll_lines for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.payroll_runs pr
      join public.locations l on l.id = pr.location_id
      where pr.id = payroll_run_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists payroll_lines_write on public.payroll_lines;
create policy payroll_lines_write on public.payroll_lines for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.payroll_runs pr
      join public.locations l on l.id = pr.location_id
      where pr.id = payroll_run_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.payroll_runs pr
      join public.locations l on l.id = pr.location_id
      where pr.id = payroll_run_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- breeding_events: link semen draw + bull
-- -------------------------------------------------------------------
-- Idempotent column adds so existing repro_events can reference a straw row.
do $$ begin
  alter table public.repro_events
    add column if not exists semen_straw_id uuid references public.semen_straws(id) on delete set null;
  alter table public.repro_events
    add column if not exists service_sire_animal_id uuid references public.animals(id) on delete set null;
  alter table public.repro_events
    add column if not exists stock_movement_id uuid references public.stock_movements(id) on delete set null;
exception when undefined_table then null; end $$;
