-- =====================================================================
-- wipe.sql — complete teardown. Drops the ENTIRE public schema (every
-- table, type, function, trigger, view) and recreates it empty with the
-- standard Supabase grants. auth.users is left intact; only the role/org
-- we stamped on them is cleared.
--
-- Destructive and irreversible. Run this, then run 0001_auth.sql.
-- =====================================================================

drop schema if exists public cascade;
create schema public;

alter schema public owner to postgres;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

update auth.users
   set raw_app_meta_data = raw_app_meta_data - 'role' - 'organization_id'
 where raw_app_meta_data ?| array['role', 'organization_id'];

-- Schema is empty. Run 0001_auth.sql next.
