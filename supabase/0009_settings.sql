-- =====================================================================
-- 0009_settings.sql — Phase 11a: per-org settings. Unit system
-- (canonical storage is metric; this drives convert-at-the-edges),
-- a region-neutral country profile, and the herd-parameters /
-- assumptions store (VWP, dry-lead, prices, ME factors…). One row per
-- org, auto-seeded. Run AFTER 0008. No RLS; anon/auth revoked,
-- service_role only. Idempotent.
-- =====================================================================

create table if not exists public.org_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  unit_system     text not null default 'metric'
                    check (unit_system in ('metric','imperial')),
  country         text not null default 'XX',   -- region-neutral; profile, not hardwired
  params          jsonb not null default '{}'::jsonb,  -- herd assumptions
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists org_settings_set_updated_at on public.org_settings;
create trigger org_settings_set_updated_at before update on public.org_settings
  for each row execute function public.set_updated_at();

revoke all on public.org_settings from anon, authenticated;
grant  all on public.org_settings to service_role;

-- ensure every existing org has a settings row
insert into public.org_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;
