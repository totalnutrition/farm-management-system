-- ===================================================================
-- 0022_tmr_recipes.sql
-- TMR (Total Mixed Ration) recipes: a header + per-ingredient lines.
-- A recipe can be assigned to one or more location_groups; feeding
-- events can optionally reference a recipe so the consumed kg are
-- apportioned across its ingredients.
-- ===================================================================

create table if not exists public.tmr_recipes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  description text,
  target_dm_intake_kg numeric(8, 2),       -- target intake per cow per day, DM basis
  target_cows int,                         -- batch headcount the recipe is sized for
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create index if not exists tmr_recipes_location_idx
  on public.tmr_recipes(location_id);

drop trigger if exists tmr_recipes_set_updated_at on public.tmr_recipes;
create trigger tmr_recipes_set_updated_at
  before update on public.tmr_recipes
  for each row execute function public.set_updated_at();

alter table public.tmr_recipes enable row level security;
drop policy if exists tmr_recipes_select on public.tmr_recipes;
create policy tmr_recipes_select on public.tmr_recipes for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.locations l
      where l.id = location_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists tmr_recipes_write on public.tmr_recipes;
create policy tmr_recipes_write on public.tmr_recipes for all
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
-- Ingredient lines
-- -------------------------------------------------------------------
create table if not exists public.tmr_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.tmr_recipes(id) on delete cascade,
  feed_material_id uuid references public.org_feed_materials(id) on delete set null,
  display_name text not null,              -- denormalised for fast list rendering
  as_fed_kg_per_cow numeric(8, 3) not null default 0,
  display_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (recipe_id, display_name)
);

create index if not exists tmr_recipe_lines_recipe_idx
  on public.tmr_recipe_lines(recipe_id, display_order);

alter table public.tmr_recipe_lines enable row level security;
drop policy if exists tmr_recipe_lines_select on public.tmr_recipe_lines;
create policy tmr_recipe_lines_select on public.tmr_recipe_lines for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists tmr_recipe_lines_write on public.tmr_recipe_lines;
create policy tmr_recipe_lines_write on public.tmr_recipe_lines for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );

-- -------------------------------------------------------------------
-- Group ↔ recipe assignment (one or many recipes per group)
-- -------------------------------------------------------------------
create table if not exists public.tmr_group_assignments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.tmr_recipes(id) on delete cascade,
  group_id uuid not null references public.location_groups(id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (recipe_id, group_id)
);

create index if not exists tmr_group_assignments_group_idx
  on public.tmr_group_assignments(group_id);

alter table public.tmr_group_assignments enable row level security;
drop policy if exists tmr_group_assignments_select on public.tmr_group_assignments;
create policy tmr_group_assignments_select on public.tmr_group_assignments for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists tmr_group_assignments_write on public.tmr_group_assignments;
create policy tmr_group_assignments_write on public.tmr_group_assignments for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.tmr_recipes r
      join public.locations l on l.id = r.location_id
      where r.id = recipe_id and l.organization_id = public.auth_org_id()
    )
  );

-- Add recipe FK on feed_events so a feeding can reference its TMR.
do $$ begin
  alter table public.feed_events
    add column if not exists recipe_id uuid references public.tmr_recipes(id) on delete set null;
exception when undefined_table then null; end $$;
