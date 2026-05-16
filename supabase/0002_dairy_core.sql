-- =====================================================================
-- 0002_dairy_core.sql — Phase 1 backbone: the multi-subject, immutable,
-- offline-syncable event ledger + the typed item / event / repro
-- catalogs. Run AFTER 0001_auth.sql.
--
-- DESIGN DECISIONS (ratified with the product owner):
--  * NO Row Level Security. Tenant isolation is NOT a privacy boundary
--    here (single operator, no competitors, cross-farm aggregate
--    insights are a first-class goal). Instead, every domain table is
--    REVOKEd from anon/authenticated and GRANTed only to service_role,
--    so there is no public PostgREST surface at all — all access is
--    server-mediated. organization_id is retained purely for app-level
--    scoping and cross-farm analytics, not for RLS.
--  * The events table is APPEND-ONLY, enforced by a trigger. Corrections
--    are themselves new events, never UPDATE/DELETE. This is the core
--    invariant: nothing mutates state except a new event.
--  * The ledger carries offline-sync metadata (device_id, client_seq,
--    occurred_at) so on-device stores can generate events offline and
--    converge on sync. (device_id, client_seq) is unique => idempotent
--    replay.
--  * Catalogs are seeded ONLY with provenance-tagged, source-confirmed
--    data. Item numbers/names come verbatim from the official VAS
--    "DairyComp Standard Items" page. Event codes are seeded only for
--    the 6 whose NUMBER is source-confirmed; the rest are added when
--    the numeric event map is obtained. No fabricated numbers/formulas.
--
-- Idempotent and re-runnable.
-- =====================================================================

-- --- shared helpers ---------------------------------------------------
-- set_updated_at is created by 0001_auth.sql; redefined here (identical)
-- so this migration is self-consistent if run/verified standalone.
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- --- enums ------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'subject_type') then
    create type subject_type as enum
      ('animal','pen','ration','feed','parlor','tank');
  end if;
end $$;

-- =====================================================================
-- subjects — every trackable thing (the multi-subject ledger root)
-- =====================================================================
create table if not exists public.subjects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_type    subject_type not null,
  natural_key     text not null,                    -- cow ID, pen no., ration code…
  name            text,
  status          text not null default 'active'
                    check (status in ('active','inactive','archived')),
  attrs           jsonb not null default '{}'::jsonb, -- subject-type typed attributes
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, subject_type, natural_key)
);
create index if not exists subjects_org_idx   on public.subjects(organization_id);
create index if not exists subjects_type_idx  on public.subjects(organization_id, subject_type);

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- =====================================================================
-- event_codes — the EC catalog (per-org). Definition model from ALTER9:
-- name<=7 chars, system(1-18) sacred, prompts, gap consolidation,
-- combo sets, handler (rc transition / cascades / branches), display.
-- NOTE: code is NOT capped at 64 — a V10 cowfile allows up to ~217.
-- =====================================================================
create table if not exists public.event_codes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code            int  not null check (code between 1 and 9999),
  name            text not null check (char_length(name) <= 7),
  label           text,
  is_system       boolean not null default false,
  prompts         jsonb not null default '{}'::jsonb,  -- {event_day,remark,items:[]}
  handler         jsonb not null default '{}'::jsonb,  -- {rc_transition,cascades,branch_rules,creates_subject}
  gap_days        int  not null default 0,             -- duplicate-event consolidation window
  is_combo        boolean not null default false,
  combo_members   int[],                               -- event codes referenced by a combo
  team            text,
  display         jsonb,                               -- {text_color,bg_color}
  provenance      text not null default 'unsourced',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, code),
  check (not is_system or code between 1 and 18)
);
create index if not exists event_codes_org_idx on public.event_codes(organization_id);

drop trigger if exists event_codes_set_updated_at on public.event_codes;
create trigger event_codes_set_updated_at before update on public.event_codes
  for each row execute function public.set_updated_at();

-- =====================================================================
-- item_definitions — the typed item dictionary (per-org). Model from
-- ALTER2: number (range-banded namespace), type (formula class),
-- op1/op2 operands, calculated/system flags, standard_id, plus our own
-- pluggable derivation spec (filled in Phase 2, provenance-tagged).
-- =====================================================================
create table if not exists public.item_definitions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number          int  not null,
  name            text not null,
  label           text,
  description     text,
  applies_to      subject_type not null default 'animal',
  data_type       text not null default 'text'
                    check (data_type in ('text','int','numeric','date','code','bool')),
  is_calculated   boolean not null default false,
  is_system       boolean not null default false,
  standard_id     int,                                 -- maps to VAS standard item #
  type            int,                                 -- formula-class Type (null until sourced)
  op1             text,
  op2             text,
  derivation      jsonb not null default '{}'::jsonb,  -- our pluggable derivation spec
  provenance      text not null default 'unsourced',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (organization_id, number),
  -- the official VAS item-number namespace bands
  check (number between 1 and 89
      or number between 90 and 1023
      or number between 1024 and 1999
      or number >= 2000)
);
create index if not exists item_definitions_org_idx on public.item_definitions(organization_id);

drop trigger if exists item_definitions_set_updated_at on public.item_definitions;
create trigger item_definitions_set_updated_at before update on public.item_definitions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- reproductive_codes — standard 0..8 reference (invariant across all
-- DC herds; a global lookup, not tenant data).
-- =====================================================================
create table if not exists public.reproductive_codes (
  code        int primary key check (code between 0 and 8),
  rpro        text not null,
  description text not null
);

-- =====================================================================
-- events — the immutable, offline-syncable ledger (the heart)
-- =====================================================================
create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),  -- client-generatable
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_id      uuid not null references public.subjects(id) on delete cascade,
  event_code      int  not null,
  event_date      date not null,                       -- EDAY (the dairy event date)
  remark          text,                                -- REM
  payload         jsonb not null default '{}'::jsonb,  -- item-writes
  source          text not null default 'user'
                    check (source in ('user','device','integration','system')),
  device_id       text,                                -- offline: originating device
  client_seq      bigint,                              -- offline: per-device logical clock
  occurred_at     timestamptz,                         -- device wall-clock of the action
  recorded_at     timestamptz not null default now(),  -- server receive time
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  foreign key (organization_id, event_code)
    references public.event_codes(organization_id, code)
);
create index if not exists events_subject_date_idx on public.events(subject_id, event_date);
create index if not exists events_org_idx          on public.events(organization_id);
create index if not exists events_code_idx         on public.events(organization_id, event_code);
-- idempotent offline replay: a device's event is unique by its local seq
create unique index if not exists events_device_seq_uidx
  on public.events(device_id, client_seq)
  where device_id is not null and client_seq is not null;

-- append-only enforcement: nothing mutates a recorded event. Corrections
-- are new events. This is the core ledger invariant.
create or replace function public.events_block_mutation() returns trigger
  language plpgsql as $$
begin
  raise exception
    'events is append-only: % is not permitted (record corrections as new events)',
    tg_op;
end; $$;

drop trigger if exists events_no_update on public.events;
create trigger events_no_update before update on public.events
  for each row execute function public.events_block_mutation();
drop trigger if exists events_no_delete on public.events;
create trigger events_no_delete before delete on public.events
  for each row execute function public.events_block_mutation();

-- =====================================================================
-- ACCESS MODEL — no RLS; close the public surface instead.
-- 0001/wipe set default privileges granting anon/authenticated on new
-- tables, so we must explicitly revoke. Only service_role (server) may
-- touch domain data.
-- =====================================================================
revoke all on public.subjects,
              public.events,
              public.event_codes,
              public.item_definitions,
              public.reproductive_codes
  from anon, authenticated;
grant  all on public.subjects,
              public.events,
              public.event_codes,
              public.item_definitions,
              public.reproductive_codes
  to service_role;

-- =====================================================================
-- SEED — reproductive codes (source-confirmed: VAS Reproductive Codes
-- page + DC305 Vocabulary sheet). Fully canonical.
-- =====================================================================
insert into public.reproductive_codes (code, rpro, description) values
  (0,'VIRGIN','No status / virgin heifer — not yet bred'),
  (1,'DNB',   'Do Not Breed'),
  (2,'FRESH', 'Recently fresh'),
  (3,'OPEN',  'OK / Open — eligible to breed'),
  (4,'BRED',  'Inseminated, outcome not yet known'),
  (5,'PREG',  'Declared pregnant'),
  (6,'DRY',   'In dry period'),
  (7,'SLD/DIE','Sold or died'),
  (8,'BULLCAF','Male animal')
on conflict (code) do update
  set rpro = excluded.rpro, description = excluded.description;

-- =====================================================================
-- SEED — per-organization catalogs for every existing organization.
-- (Phase 1 seeds the confirmed core; the loop keeps it idempotent and
-- applies to all orgs created by 0001_auth.sql.)
-- =====================================================================
do $seed$
declare org record;
begin
for org in select id from public.organizations loop

  -- ---- event_codes: ONLY number-confirmed system events. Numbers and
  -- ---- behavior are source-confirmed (overview macros + Event
  -- ---- Definitions page). Remaining events added when the numeric
  -- ---- event map is sourced — deliberately NOT fabricated here.
  insert into public.event_codes
    (organization_id, code, name, label, is_system, handler, provenance)
  values
    (org.id, 1,'FRESH','Calving / new lactation', true,
      '{"rc_transition":2,"effects":["lactation+1","set FDAT"],"creates_subject":"calf"}'::jsonb,
      'confirmed: VAS Event Definitions + DC overview (EC=1)'),
    (org.id, 5,'BRED','Bred (AI or bull)', true,
      '{"rc_transition":4,"effects":["TBRD+1","set LSIR"],"branch_rules":["if PREG: set VC=7 / ABT?"]}'::jsonb,
      'confirmed: VAS Event Definitions + DC overview (EC=5)'),
    (org.id,11,'DRY','Dry-off (end of lactation)', true,
      '{"rc_transition":6,"effects":["set DDAT"]}'::jsonb,
      'confirmed: VAS Event Definitions + DC overview (EC=11)'),
    (org.id,12,'ABORT','Pregnancy loss', true,
      '{"branch_rules":["if DCC>152: new lactation","if DCC<152: stay; prompt RC"]}'::jsonb,
      'confirmed: VAS Event Definitions + DC overview (EC=12)'),
    (org.id,13,'DNB','Do Not Breed', true,
      '{"rc_transition":1,"effects":["auto on freemartin"],"branch_rules":["BRED/PREG/DRY clears DNB"]}'::jsonb,
      'confirmed: VAS Event Definitions + DC overview (EC=13)'),
    (org.id,15,'DIED','Died / removed from herd', true,
      '{"rc_transition":7}'::jsonb,
      'confirmed: VAS Event Definitions + DC overview (EC=15)')
  on conflict (organization_id, code) do nothing;

  -- ---- item_definitions: default standard items 1..89 + predefined
  -- ---- 2000+ , verbatim from the official VAS "DairyComp Standard
  -- ---- Items" page. is_calculated set for the items the page
  -- ---- describes as calculated. Numbers 80,81,85,88 are not on the
  -- ---- current official page (left out, not invented).
  insert into public.item_definitions
    (organization_id, number, name, description, is_system, is_calculated,
     standard_id, provenance)
  values
    (org.id,  1,'ID',   'Animal identifier',                         true,false,  1,'vas-standard-items'),
    (org.id,  2,'PEN',  'Pen number',                                true,false,  2,'vas-standard-items'),
    (org.id,  3,'VC',   'Vet code (1-13)',                           true,false,  3,'vas-standard-items'),
    (org.id,  4,'REG',  'Animal registration number',                true,false,  4,'vas-standard-items'),
    (org.id,  5,'EID',  '15-digit electronic ID (eartag)',           true,false,  5,'vas-standard-items'),
    (org.id,  6,'CBRD', 'Cattle breed',                              true,false,  6,'vas-standard-items'),
    (org.id,  7,'DID',  'Dam identifier',                            true,false,  7,'vas-standard-items'),
    (org.id,  8,'DREG', 'Dam USDA or REG number',                    true,false,  8,'vas-standard-items'),
    (org.id,  9,'DBRD', 'Dam breed',                                 true,false,  9,'vas-standard-items'),
    (org.id, 10,'SID',  'Sire identifier',                           true,false, 10,'vas-standard-items'),
    (org.id, 11,'BDAT', 'Birth date',                                true,false, 11,'vas-standard-items'),
    (org.id, 12,'EDAT', 'Enrollment date',                           true,false, 12,'vas-standard-items'),
    (org.id, 13,'LACT', 'Lactation number',                          true,false, 13,'vas-standard-items'),
    (org.id, 14,'PSTRH','Permanent string or pen',                   true,false, 14,'vas-standard-items'),
    (org.id, 15,'RC',   'Reproductive code (1-8)',                   true,false, 15,'vas-standard-items'),
    (org.id, 16,'STAT', 'DHIA status code (1,2,6)',                  true,false, 16,'vas-standard-items'),
    (org.id, 17,'CAR',  'Condition affecting record / disposal code',true,false, 17,'vas-standard-items'),
    (org.id, 18,'EDAY', 'Event day',                                 true,false, 18,'vas-standard-items'),
    (org.id, 19,'EC',   'Event code (1-64)',                         true,false, 19,'vas-standard-items'),
    (org.id, 20,'INT',  'Interval',                                  true,false, 20,'vas-standard-items'),
    (org.id, 21,'REM',  'Remark or comment',                         true,false, 21,'vas-standard-items'),
    (org.id, 22,'SIR1', '1st choice mating sire',                    true,false, 22,'vas-standard-items'),
    (org.id, 23,'SIR2', '2nd choice mating sire',                    true,false, 23,'vas-standard-items'),
    (org.id, 24,'CNTL', 'Computer number',                           true,false, 24,'vas-standard-items'),
    (org.id, 25,'LSIR', 'Last service sire',                         true,false, 25,'vas-standard-items'),
    (org.id, 26,'SIRC', 'Sire of conception',                        true,false, 26,'vas-standard-items'),
    (org.id, 27,'TBRD', 'Times bred',                                true,false, 27,'vas-standard-items'),
    (org.id, 28,'HDAT', 'Heat date',                                 true,false, 28,'vas-standard-items'),
    (org.id, 29,'FDAT', 'Fresh date',                                true,false, 29,'vas-standard-items'),
    (org.id, 30,'CDAT', 'Conception date',                           true,false, 30,'vas-standard-items'),
    (org.id, 31,'DDAT', 'Dry date',                                  true,false, 31,'vas-standard-items'),
    (org.id, 32,'PODAT','Pregnant/open date',                        true,false, 32,'vas-standard-items'),
    (org.id, 33,'PFDAT','Previous fresh date',                       true,false, 33,'vas-standard-items'),
    (org.id, 34,'PCDAT','Previous conception date',                  true,false, 34,'vas-standard-items'),
    (org.id, 35,'PDDAT','Previous dry date',                         true,false, 35,'vas-standard-items'),
    (org.id, 36,'PCUDT','Previous close-up move date',               true,false, 36,'vas-standard-items'),
    (org.id, 37,'BLDAT','Bullpen entry date',                        true,false, 37,'vas-standard-items'),
    (org.id, 38,'ABDAT','Abortion date',                             true,false, 38,'vas-standard-items'),
    (org.id, 39,'ADDAT','Abortion determination date',               true,false, 39,'vas-standard-items'),
    (org.id, 40,'VDAT', 'Vet check date',                            true,false, 40,'vas-standard-items'),
    (org.id, 41,'TDAT', 'Test date',                                 true,false, 41,'vas-standard-items'),
    (org.id, 42,'ETDAM','Embryo transfer dam',                       true,false, 42,'vas-standard-items'),
    (org.id, 43,'ARDAT','Archive date',                              true,false, 43,'vas-standard-items'),
    (org.id, 44,'TOTM', 'Total milk this lactation',                 true,false, 44,'vas-standard-items'),
    (org.id, 45,'TOTF', 'Total fat this lactation',                  true,false, 45,'vas-standard-items'),
    (org.id, 46,'TOTP', 'Total protein/SNF this lactation',          true,false, 46,'vas-standard-items'),
    (org.id, 47,'RELV', 'Relative value %',                          true,true,  47,'vas-standard-items'),
    (org.id, 48,'TPEN', 'Test day pen location',                     true,false, 48,'vas-standard-items'),
    (org.id, 49,'SCC',  'Somatic cell count',                        true,false, 49,'vas-standard-items'),
    (org.id, 50,'MILK', 'Current test day milk',                     true,false, 50,'vas-standard-items'),
    (org.id, 51,'FCM',  'Current fat corrected milk',                true,true,  51,'vas-standard-items'),
    (org.id, 52,'305ME','305 day mature herd equivalent',            true,true,  52,'vas-standard-items'),
    (org.id, 53,'PCTP', 'Percent protein/SNF',                       true,false, 53,'vas-standard-items'),
    (org.id, 54,'PCTF', 'Percent fat',                               true,false, 54,'vas-standard-items'),
    (org.id, 55,'MEFAC','Mature equivalent factor',                  true,true,  55,'vas-standard-items'),
    (org.id, 56,'PSIRC','Previous lactation sire of conception',     true,false, 56,'vas-standard-items'),
    (org.id, 57,'PDIM', 'Previous lactation days in milk',           true,false, 57,'vas-standard-items'),
    (org.id, 58,'PDOPN','Previous lactation days open',              true,false, 58,'vas-standard-items'),
    (org.id, 59,'PTBRD','Previous lactation times bred',             true,false, 59,'vas-standard-items'),
    (org.id, 60,'PTOTM','Previous lactation total milk',             true,false, 60,'vas-standard-items'),
    (org.id, 61,'PTOTF','Previous lactation total fat',              true,false, 61,'vas-standard-items'),
    (org.id, 62,'PTOTP','Previous lactation total protein/SNF',      true,false, 62,'vas-standard-items'),
    (org.id, 63,'PVET', 'Previous vet code',                         true,false, 63,'vas-standard-items'),
    (org.id, 64,'OLDID','Old ID',                                    true,false, 64,'vas-standard-items'),
    (org.id, 65,'DCCP', 'Days carried calf at pregnancy check',      true,false, 65,'vas-standard-items'),
    (org.id, 66,'HINT', 'Heat interval',                             true,false, 66,'vas-standard-items'),
    (org.id, 67,'CALF1','Recent identified offspring',               true,false, 67,'vas-standard-items'),
    (org.id, 68,'CALF2','Previous identified offspring',             true,false, 68,'vas-standard-items'),
    (org.id, 69,'CALF3','Oldest identified offspring',               true,false, 69,'vas-standard-items'),
    (org.id, 70,'CODA', 'Wildcard 1-byte (any character)',           true,false, 70,'vas-standard-items'),
    (org.id, 71,'COD1', 'Wildcard 1-byte (0-255)',                   true,false, 71,'vas-standard-items'),
    (org.id, 72,'COD2', 'Wildcard 2-byte (0-32000)',                 true,false, 72,'vas-standard-items'),
    (org.id, 73,'XDAT', 'Wildcard date item',                        true,false, 73,'vas-standard-items'),
    (org.id, 74,'NOTE', 'Permanent note',                            true,false, 74,'vas-standard-items'),
    (org.id, 75,'DIM',  'Days in milk',                              true,true,  75,'vas-standard-items'),
    (org.id, 76,'DOPN', 'Days open',                                 true,true,  76,'vas-standard-items'),
    (org.id, 77,'DDRY', 'Days dry',                                  true,true,  77,'vas-standard-items'),
    (org.id, 78,'DUE',  'Due to freshen',                            true,true,  78,'vas-standard-items'),
    (org.id, 79,'DCC',  'Days carrying calf / pregnant',             true,true,  79,'vas-standard-items'),
    (org.id, 82,'TODAY','Today''s date',                             true,true,  82,'vas-standard-items'),
    (org.id, 83,'VETC', 'Reason for vet check',                      true,false, 83,'vas-standard-items'),
    (org.id, 84,'RPRO', 'Reproductive code (English)',               true,true,  84,'vas-standard-items'),
    (org.id, 86,'DSLH', 'Days since last heat',                      true,true,  86,'vas-standard-items'),
    (org.id, 87,'AGE',  'Age in months',                             true,true,  87,'vas-standard-items'),
    (org.id, 89,'TECH', 'Technician number',                         true,false, 89,'vas-standard-items'),
    -- pre-defined platform items (2000+), verbatim from same page
    (org.id,2000,'BFDAT','Beef withdrawal date',                     true,false,2000,'vas-standard-items'),
    (org.id,2001,'MKDAT','Milk withdrawal date',                     true,false,2001,'vas-standard-items'),
    (org.id,2002,'LTDAT','Last treatment date',                      true,false,2002,'vas-standard-items'),
    (org.id,2003,'COST', 'Total treatment cost',                     true,false,2003,'vas-standard-items'),
    (org.id,2004,'PN',   'Previous pen',                             true,false,2004,'vas-standard-items'),
    (org.id,2005,'HPDAT','Hospital date',                            true,false,2005,'vas-standard-items'),
    (org.id,2006,'RCDAT','Recheck date',                             true,false,2006,'vas-standard-items'),
    (org.id,2007,'THD',  'Total sick days',                          true,false,2007,'vas-standard-items'),
    (org.id,2008,'SCDAT','Last scan date',                           true,false,2008,'vas-standard-items'),
    (org.id,2009,'SCTIM','Last scan time',                           true,false,2009,'vas-standard-items'),
    (org.id,2010,'SCMTH','Last scan method',                         true,false,2010,'vas-standard-items'),
    (org.id,2011,'SCPEN','Last scan pen',                            true,false,2011,'vas-standard-items'),
    (org.id,2012,'BNAME','Barn name',                                true,false,2012,'vas-standard-items'),
    (org.id,2013,'EASE', 'Calving ease',                             true,false,2013,'vas-standard-items'),
    (org.id,2014,'CWVAL','Cow value',                                true,true, 2014,'vas-standard-items'),
    (org.id,2015,'PGVAL','Pregnancy value',                          true,true, 2015,'vas-standard-items'),
    (org.id,2016,'SIR3', 'Sire preference 3',                        true,false,2016,'vas-standard-items'),
    (org.id,2017,'SIR4', 'Sire preference 4',                        true,false,2017,'vas-standard-items'),
    (org.id,2018,'SYDAT','Ovsynch enrollment date',                  true,false,2018,'vas-standard-items'),
    (org.id,2019,'CLIV', 'Calf livability',                          true,false,2019,'vas-standard-items'),
    (org.id,2020,'CVACC','Calf vaccination',                         true,false,2020,'vas-standard-items'),
    (org.id,2021,'SF',   'Source farm',                              true,false,2021,'vas-standard-items'),
    (org.id,2044,'EXPCALF','Expected calf',                          true,false,2044,'vas-standard-items')
  on conflict (organization_id, number) do nothing;

end loop;
end $seed$;
