-- ===================================================================
-- 0026_fix_group_moves_rls.sql
-- Fix the "operator does not exist: uuid = text" error in the
-- group_moves RLS policies.
--
-- Bug: the policy referenced `animal_id` unqualified inside a join
-- against public.animals (which has its own column `animal_id text`
-- — the on-farm management number). Postgres resolved the bare
-- identifier to a.animal_id (text), making the comparison
-- a.id (uuid) = a.animal_id (text) and tripping 42883.
-- Fix: qualify the outer reference as public.group_moves.animal_id.
-- ===================================================================

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
