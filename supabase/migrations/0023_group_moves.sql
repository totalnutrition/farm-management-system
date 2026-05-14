-- ===================================================================
-- 0023_group_moves.sql
-- Group-assignment decisions log. The rule engine suggests a group
-- per animal from location_groups.rule_predicates; the user accepts
-- (move) or overrides (stay, with reason). Each decision is logged
-- here for traceability + so the engine can suppress repeat
-- suggestions for an animal whose facts haven't changed.
-- ===================================================================

do $$ begin
  create type public.group_move_decision as enum (
    'accepted',     -- user accepted rule's suggestion
    'overridden',   -- user kept current, with reason
    'manual',       -- user moved without a rule suggestion
    'auto'          -- batch / cron applied
  );
exception when duplicate_object then null; end $$;

create table if not exists public.group_moves (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  from_group_id uuid references public.location_groups(id) on delete set null,
  to_group_id uuid references public.location_groups(id) on delete set null,
  suggested_group_id uuid references public.location_groups(id) on delete set null,
  decision public.group_move_decision not null,
  reason text,
  rule_explanation text,
  operator_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists group_moves_animal_at_idx
  on public.group_moves(animal_id, occurred_at desc);

alter table public.group_moves enable row level security;
drop policy if exists group_moves_select on public.group_moves;
create policy group_moves_select on public.group_moves for select
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.animals a
      join public.locations l on l.id = a.location_id
      where a.id = public.group_moves.animal_id
        and l.organization_id = public.auth_org_id()
    )
  );
drop policy if exists group_moves_write on public.group_moves;
create policy group_moves_write on public.group_moves for all
  using (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.animals a
      join public.locations l on l.id = a.location_id
      where a.id = public.group_moves.animal_id
        and l.organization_id = public.auth_org_id()
    )
  )
  with check (
    public.auth_role() = 'super_admin'
    or exists (
      select 1 from public.animals a
      join public.locations l on l.id = a.location_id
      where a.id = public.group_moves.animal_id
        and l.organization_id = public.auth_org_id()
    )
  );

-- Track when a cow's grouping was last reviewed (either accepted or
-- overridden) so the engine can suppress repeat suggestions for the
-- same set of facts until something changes.
do $$ begin
  alter table public.animals
    add column if not exists last_group_decision_at timestamptz,
    add column if not exists last_group_override_reason text;
exception when undefined_table then null; end $$;
