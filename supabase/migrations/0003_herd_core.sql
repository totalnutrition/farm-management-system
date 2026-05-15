-- =====================================================================
-- 0003 — Herd core: the cow is the only entity; everything is a dated
--        event on a cow. History is append-only (corrections are events).
-- Doctrine refs: #1 cow+event-stream, #2 populations-as-queries,
--                #6 small herd settings, #10 immutable history,
--                #11 user-definable lists.
-- =====================================================================

-- ---------- enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'animal_sex') then
    create type animal_sex as enum ('female', 'male');
  end if;
  if not exists (select 1 from pg_type where typname = 'animal_status') then
    create type animal_status as enum ('active', 'sold', 'dead', 'culled');
  end if;
end$$;

-- ---------- animals: identity + cached computed fields ----------
-- Cached fields (current_pen, repro_status, last_*, lactation_number,
-- days_in_milk) are DERIVED from animal_events and refreshed on event
-- insert. They exist only so list/work queries stay fast — the event
-- stream remains the source of truth.
create table if not exists public.animals (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  tag               text not null,
  name              text,
  sex               animal_sex not null default 'female',
  breed             text,
  birth_date        date,
  dam_tag           text,
  sire_tag          text,
  entered_herd_at   date,
  status            animal_status not null default 'active',
  -- derived caches (do not hand-edit; set by event flow):
  current_pen       text,
  lactation_number  int not null default 0,
  repro_status      text not null default 'open',
  last_calving_at   date,
  last_bred_at      date,
  last_event_at     date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  unique (organization_id, tag)
);

create index if not exists animals_organization_id_idx on public.animals(organization_id);
create index if not exists animals_status_idx on public.animals(organization_id, status);
create index if not exists animals_pen_idx on public.animals(organization_id, current_pen);
create index if not exists animals_repro_idx on public.animals(organization_id, repro_status);

-- ---------- animal_events: the append-only stream ----------
-- No UPDATE/DELETE for operators. A mistake is corrected by appending a
-- new event of type 'correction' that references corrects_event_id.
create table if not exists public.animal_events (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  animal_id         uuid not null references public.animals(id) on delete cascade,
  event_type        text not null,
  event_date        date not null default current_date,
  data              jsonb not null default '{}'::jsonb,
  corrects_event_id uuid references public.animal_events(id),
  note              text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

create index if not exists animal_events_org_idx on public.animal_events(organization_id);
create index if not exists animal_events_animal_idx on public.animal_events(animal_id, event_date desc);
create index if not exists animal_events_type_idx on public.animal_events(organization_id, event_type, event_date desc);

-- ---------- herd_settings: one small row per org (#6) ----------
create table if not exists public.herd_settings (
  organization_id   uuid primary key references public.organizations(id) on delete cascade,
  voluntary_wait_days   int not null default 50,
  gestation_days        int not null default 280,
  preg_check_days       int not null default 35,
  dry_off_days_before   int not null default 60,
  -- KPI thresholds feed the monitor (#7):
  kpi_repro_pr_target       numeric not null default 22,
  kpi_max_days_open         int not null default 130,
  kpi_max_dim_open          int not null default 150,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- herd_lists: user-definable saved populations (#11) ----------
create table if not exists public.herd_lists (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  key               text not null,
  name              text not null,
  criteria          jsonb not null default '{}'::jsonb,
  is_builtin        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  unique (organization_id, key)
);

create index if not exists herd_lists_org_idx on public.herd_lists(organization_id);

-- ---------- updated_at triggers ----------
drop trigger if exists animals_set_updated_at on public.animals;
create trigger animals_set_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

drop trigger if exists herd_settings_set_updated_at on public.herd_settings;
create trigger herd_settings_set_updated_at
  before update on public.herd_settings
  for each row execute function public.set_updated_at();

drop trigger if exists herd_lists_set_updated_at on public.herd_lists;
create trigger herd_lists_set_updated_at
  before update on public.herd_lists
  for each row execute function public.set_updated_at();

-- ---------- event -> animal cache refresh (#1: stream is truth) ----------
create or replace function public.apply_animal_event()
returns trigger language plpgsql as $$
begin
  update public.animals a set
    last_event_at = greatest(coalesce(a.last_event_at, new.event_date), new.event_date),
    current_pen = case when new.event_type = 'move'
                       then coalesce(new.data->>'pen', a.current_pen) else a.current_pen end,
    last_bred_at = case when new.event_type = 'breeding'
                        then new.event_date else a.last_bred_at end,
    repro_status = case
                     when new.event_type = 'breeding' then 'bred'
                     when new.event_type = 'preg_check' and (new.data->>'result') = 'pregnant' then 'pregnant'
                     when new.event_type = 'preg_check' and (new.data->>'result') = 'open' then 'open'
                     when new.event_type = 'calving' then 'fresh'
                     when new.event_type = 'dry_off' then 'dry'
                     else a.repro_status end,
    last_calving_at = case when new.event_type = 'calving'
                           then new.event_date else a.last_calving_at end,
    lactation_number = case when new.event_type = 'calving'
                            then a.lactation_number + 1 else a.lactation_number end,
    status = case
               when new.event_type = 'sale' then 'sold'::animal_status
               when new.event_type = 'death' then 'dead'::animal_status
               when new.event_type = 'cull' then 'culled'::animal_status
               else a.status end
  where a.id = new.animal_id;
  return new;
end;
$$;

drop trigger if exists animal_events_apply on public.animal_events;
create trigger animal_events_apply
  after insert on public.animal_events
  for each row execute function public.apply_animal_event();

-- ---------- RLS ----------
alter table public.animals enable row level security;
alter table public.animal_events enable row level security;
alter table public.herd_settings enable row level security;
alter table public.herd_lists enable row level security;

-- animals: org-scoped read; admins write
drop policy if exists animals_select on public.animals;
create policy animals_select on public.animals for select
  using (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id());

drop policy if exists animals_modify on public.animals;
create policy animals_modify on public.animals for all
  using (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()))
  with check (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()));

-- animal_events: org-scoped read; INSERT only (append-only, #10).
-- Deliberately NO update/delete policy -> history is immutable.
drop policy if exists animal_events_select on public.animal_events;
create policy animal_events_select on public.animal_events for select
  using (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id());

drop policy if exists animal_events_insert on public.animal_events;
create policy animal_events_insert on public.animal_events for insert
  with check (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()));

-- herd_settings: org-scoped read; admins write
drop policy if exists herd_settings_select on public.herd_settings;
create policy herd_settings_select on public.herd_settings for select
  using (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id());

drop policy if exists herd_settings_modify on public.herd_settings;
create policy herd_settings_modify on public.herd_settings for all
  using (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()))
  with check (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()));

-- herd_lists: org-scoped read; admins write
drop policy if exists herd_lists_select on public.herd_lists;
create policy herd_lists_select on public.herd_lists for select
  using (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id());

drop policy if exists herd_lists_modify on public.herd_lists;
create policy herd_lists_modify on public.herd_lists for all
  using (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()))
  with check (public.auth_role() in ('super_admin','admin') and (public.auth_role() = 'super_admin' or organization_id = public.auth_org_id()));
