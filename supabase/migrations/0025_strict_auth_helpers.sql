-- ===================================================================
-- 0025_strict_auth_helpers.sql
-- Defensive: re-declare auth_role() / auth_org_id() with explicit
-- text → uuid casting so RLS predicates can never trip the
-- "operator does not exist: uuid = text" error in environments
-- where the function bodies somehow ended up returning text.
--
-- Idempotent: replaces both functions in place; existing call sites
-- (RLS policies, triggers) keep working unchanged.
-- ===================================================================

create or replace function public.auth_role() returns text language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role')::text,
    null
  );
$$;

create or replace function public.auth_org_id() returns uuid language sql stable as $$
  select case
    when nullif(auth.jwt() -> 'app_metadata' ->> 'organization_id', '') is null
      then null::uuid
    else (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
  end;
$$;

-- Sanity probe (no-op result, but raises a friendly error if the
-- helpers are wired wrong):
do $$
begin
  perform public.auth_org_id();
  perform public.auth_role();
end$$;
