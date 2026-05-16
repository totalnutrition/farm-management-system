-- =====================================================================
-- 0010_audit.sql — Phase 11b: the activity / audit trail. Captured by
-- DATABASE TRIGGERS so it cannot be bypassed by any code path and
-- needs zero app instrumentation. `enter` = a ledger event; `alter` =
-- a config/catalog change. Run AFTER 0009. No RLS; anon/auth revoked,
-- service_role only. Idempotent.
-- =====================================================================

create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  actor           uuid,                          -- created_by, when present
  source          text not null default 'user',  -- user|device|integration|system
  category        text not null,                 -- enter|alter
  table_name      text not null,
  subject_id      uuid,
  event_code      int,
  event_date      date,
  description     text not null
);
create index if not exists audit_log_org_idx
  on public.audit_log(organization_id, occurred_at desc);

revoke all on public.audit_log from anon, authenticated;
grant  all on public.audit_log to service_role;

-- ledger inserts → an `enter` audit row
create or replace function public.audit_event() returns trigger
  language plpgsql as $$
begin
  insert into public.audit_log(organization_id, actor, source, category,
    table_name, subject_id, event_code, event_date, description)
  values (new.organization_id, new.created_by, new.source, 'enter',
    'events', new.subject_id, new.event_code, new.event_date,
    'event ' || new.event_code);
  return null;
end $$;

drop trigger if exists events_audit on public.events;
create trigger events_audit after insert on public.events
  for each row execute function public.audit_event();

-- config/catalog changes → an `alter` audit row (tables with
-- organization_id + created_by)
create or replace function public.audit_change() returns trigger
  language plpgsql as $$
declare rec record;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  insert into public.audit_log(organization_id, actor, source,
    category, table_name, description)
  values (rec.organization_id, rec.created_by, 'user', 'alter',
    tg_table_name, tg_op || ' ' || tg_table_name);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'grouping_rules','monitor_kpis','protocols','subjects'
  ] loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_change()', t, t);
  end loop;
end $$;
