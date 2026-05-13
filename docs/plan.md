# FarmInsight — Master Plan

This document is the single source of truth for FarmInsight's setup, infrastructure, animal-data, recording, and pricing design. It is written from the decisions made across the design conversation and supersedes any earlier scratch notes.

It covers:

1. Product framing
2. Three-level settings model (Organization · Location · User)
3. Setup wizard
4. Data model
5. Import template
6. Milk recording, bulk-tank reconciliation, pricing
7. PR sequence
8. Decisions log

---

## 1. Product framing

FarmInsight is a multi-tenant dairy management platform.

- **Organization** is the tenant. One paying entity.
- **Location** is a single farm site under an organization. A user with the right role can manage many locations.
- **Animals and stock can move between locations** within the same organization. Locations are not data silos.
- A Location can manage **livestock**, **crops**, or **both** — controlled by per-location module toggles.
- The org has Admins; Admins assign other users to specific Locations with per-section permissions.

---

## 2. Three-level settings model

```
Organization (ORG)  ──defaults──▶  Location (LOC)  ──personalizes──▶  User
   tenant-wide               per farm/site               per person
```

- **ORG** sets defaults and catalogs that apply tenant-wide.
- **LOC** can override ORG defaults and holds farm-specific config.
- **USER** is purely personal preference; never affects other users.

Where ORG → LOC overrides exist, the LOC value is **null by default and inherits from ORG**. The LOC settings page shows `Currency: [Inherited from organization: USD ▾] [Override]`.

USER overrides for units/language are **display-only** — they never change stored values. Storage is always in the LOC's recording units; conversion happens at render.

### 2.1 Organization-level settings (ORG)

| Setting | Notes |
|---|---|
| Identity (name, logo, legal address, tax ID) | One tenant, one identity |
| Default currency | LOC may override |
| Default units (Metric / Imperial) | LOC may override |
| Default language | USER may override |
| Users (accounts, roles: Admin / Member) | Admin invites, deactivates |
| Vocabularies / catalogs — Breeds, Diagnoses, Routes, Cull reasons, NAAB sire cache, Drug library + withdrawals | LOC can add custom entries |
| Group strategy presets (Single / 2-group / 3-group / 4-group / Robotic-AMS / Custom) | LOC instantiates one |
| Pricing scheme templates (FMMO / EU component / Fonterra MS / India coop / Pakistan / Custom) | LOC instantiates with its own numbers |
| Capacity-plan defaults (Fresh 100% / High 110% / Mid 115% / Low 115% / Dry 100%) | LOC may override |
| Bunk-space defaults per group class (Fresh 30 in / High 30 / Mid 24 / Low 24) | LOC may override |
| Security policy (password policy, session timeout, MFA enforcement, SSO config, IP allowlist) | Tenant-wide |
| Audit log | Filterable by LOC |
| Data retention policy | Tenant-wide |
| Subscription, plan tier, seats, payment, invoices | Billing entity = ORG |

### 2.2 Location-level settings (LOC)

| Setting | Notes |
|---|---|
| Identity (name, code, address, pin, country, province, city) | Per farm |
| Status (active / archived) | Per farm |
| Modules (`manages_livestock`, `manages_crops`) | Per farm |
| Areas (`livestock_area_hectares`, `arable_area_hectares`) | Per farm — no map polygons in v1 |
| Timezone | Farms can be in different TZs |
| Units override | If ORG default doesn't fit |
| Currency override | For locations in a different country than HQ |
| Recording profile (test-day freq, daily flag, milkings/day, method, bulk tank freq, components) | Drives UI per farm |
| Group strategy — which preset is active + groups + rules | Per farm |
| Capacity plan — computed + override stocking % per group | Per farm |
| Infrastructure — barns, pens, parcels | Per farm |
| Milk pricing schemes (effective-dated history) | Per farm |
| Bulk-tank settings (reconciliation threshold, diversion buckets) | Per farm |
| Integrations (API keys for Lely / DeLaval / GEA / Afimilk; webhook URLs) | Per parlor |
| Notification rules (which events trigger alerts) | Per farm |
| People directories (technicians, veterinarians, hoof trimmers) | Per farm |
| Custom vocabulary additions (custom diagnoses, drugs, cull reasons) | Inherits ORG + local additions |
| Animal access scope | Animals belong to LOC; movement events span LOCs in same ORG |
| User access list | Which users from the org can access this location |
| User per-section permissions | View/edit matrix per Settings section |
| Regulatory (traceability scheme, DHI affiliation, processor name) | Per farm |

### 2.3 User-level settings (USER)

| Setting | Notes |
|---|---|
| Profile (name, email, avatar, phone) | Personal |
| Password, MFA enrollment | Personal |
| Theme (light / dark / system) | Personal |
| Language override | Personal |
| Display units override (show in kg even though farm records lb) | Display-only |
| Default landing page (Dashboard / Animals / Last viewed) | Personal |
| Active location (the switcher cookie/preference) | Personal |
| Notification channels (email / SMS / push / quiet hours) | Personal |
| Mobile companion settings (offline cache size, photo quality) | Personal |
| API tokens (personal access tokens for scripting) | Personal |

### 2.4 Settings information architecture

```
/settings
├── /account                        USER
│     Profile · Password · MFA · Theme · Display units ·
│     Notifications · Active location · API tokens
│
├── /organization                   ORG (admin)
│   ├── /general                    Identity, defaults (currency, units, language, timezone)
│   ├── /security                   Password policy, SSO, MFA enforcement, sessions, IP allowlist
│   ├── /catalogs                   Breeds · Diagnoses · Drugs · Cull reasons · NAAB sires
│   ├── /presets                    Group strategy presets · Pricing scheme templates · Capacity defaults
│   ├── /billing                    Plan · Seats · Payment · Invoices
│   └── /audit                      Audit log
│
├── /users                          ORG (admin)
│     List · Roles · Location assignments · Per-section permission matrix
│
└── /locations                      ORG (admin) — list of locations
    └── /[id]                       LOC (admin / location admin)
        ├── /general                Identity · Modules · Areas · Timezone · Units · Currency overrides
        ├── /recording              Recording profile
        ├── /infrastructure         Land parcels · Barns · Pens
        ├── /groups                 Active preset · Groups · Rules · Capacity plan
        ├── /milk-pricing           Scheme history (effective-dated)
        ├── /bulk-tank              Reconciliation threshold · Diversion buckets
        ├── /integrations           API keys · Webhooks · Import history
        ├── /notifications          Event-trigger rules
        ├── /directories            Technicians · Veterinarians · Hoof trimmers
        ├── /custom-vocabularies    Local additions to ORG catalogs
        └── /access                 Who can access this location + per-section permissions
```

The active-location switcher (top-right of app shell) scopes the `/locations/[id]/*` subtree to the chosen LOC.

---

## 3. Setup wizard

When a new Location is created, the user enters a wizard. **Every step past Step 1 is skippable.** A "Setup N of M — Finish" banner appears on that Location's overview page until setup is complete.

The wizard branches early on whether the user has existing records to import.

### 3.1 Wizard flow

```
┌────────────────────────────────────────────────────────────────────┐
│  Step 1.   Location identity + modules + areas       (required)    │
│            name, code, address, pin, country/state, units, status  │
│            ☑ Manages livestock  ☐ Manages crops                    │
│            Livestock area: ____ ha       Arable area: ____ ha      │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  Step 1.5  Recording profile                          (required)   │
│            test-day freq · daily flag · milkings/day · method ·    │
│            bulk-tank freq · component sampling                     │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                ┌─────────────────────────────────┐
                │  Do you have existing records?  │
                └─────────────────────────────────┘
                   │                          │
                  YES                        NO
                   │                          │
                   ▼                          │
┌─────────────────────────────────────┐       │
│  Step 2a.  Import animals.csv       │       │
│            (snapshot + optional     │       │
│             history files)          │       │
│  → app profiles herd from real data │       │
└─────────────────────────────────────┘       │
                   │                          │
                   ▼                          ▼
              ┌──────────────────────────────────┐
              │  Step 3.  Herd profile           │
              │           (auto-filled if 2a,    │
              │            else typed-in counts) │
              └──────────────────────────────────┘
                                │
                                ▼
              ┌──────────────────────────────────┐
              │  Step 4.  Group strategy preset  │
              │           (Single / 2-group /    │
              │            3-group / 4-group)    │
              └──────────────────────────────────┘
                                │
                                ▼
              ┌──────────────────────────────────┐
              │  Step 5.  Rules per group        │
              │           (DIM, yield, parity,   │
              │            repro — defaults pre- │
              │            filled or derived)    │
              └──────────────────────────────────┘
                                │
                                ▼
              ┌──────────────────────────────────┐
              │  Step 6.  Capacity plan          │
              │           (computed: stalls,     │
              │            bunk-ft per group)    │
              └──────────────────────────────────┘
                                │
                                ▼
              ┌──────────────────────────────────┐
              │  Step 7.  Barns                  │
              │           (full Dairyland fields,│
              │            gauge vs. plan)       │
              └──────────────────────────────────┘
                                │
                                ▼
              ┌──────────────────────────────────┐
              │  Step 8.  Pens                   │
              │           (industry pen-type taxonomy,      │
              │            assigned → group)     │
              └──────────────────────────────────┘
                                │
                                ▼
              ┌──────────────────────────────────┐
              │  Step 9.  Arable parcels         │
              │           (name + area list)     │
              │           — only if crops module │
              └──────────────────────────────────┘
                                │
                                ▼
                          Setup complete
```

**Logical design (groups + rules) must come before physical design (barns + pens)** — you can't size a barn until you know how many stalls each group needs.

### 3.2 Default group strategy presets

| Preset | Suggested for | Groups created |
|---|---|---|
| Single-group TMR | <100 lactating | Lactating · Dry · Hospital · Maternity · Heifer · Calf |
| 2-group lactating | 100–300 | High · Low · Dry · Fresh · Hospital · Maternity · Heifer · Calf |
| 3-group lactating | 300–800 | High · Mid · Low · Far-off · Close-up · Fresh · Hospital · Maternity · Heifer (split 3) · Calf |
| 4-group + age-split heifers | 800+ | Fresh-primip · Fresh-multip · High · Mid · Low · Far-off · Close-up · Hospital · Maternity · Calf · Weaned · Breeder · Bred Heifer |
| Robotic-AMS | any (v2) | Free-flow / Guided-flow with Fetch pen |
| Custom | any | Empty — user builds from scratch |

App **suggests** a preset based on `target_lactating_count` but user can override.

### 3.3 Default rule library (per group, attached to presets)

| Group | Predicate defaults |
|---|---|
| Fresh | `DIM 0–21` |
| High | `DIM 22–150` (+ `milk_yield ≥ threshold` in multi-group setups) |
| Mid | `DIM 151–250` |
| Low | `DIM 251+` |
| Close-up | `pregnancy_days ≥ 250` |
| Far-off | `dry = true AND pregnancy_days < 250` |
| Hospital | `health_flag = true` |
| Maternity | `pregnancy_days ≥ 275 OR calving_in_progress` |
| Heifer (by age) | `parity = 0 AND age_months in [a,b]` |

All editable. Yield thresholds derive from actual herd percentiles when import data is available.

### 3.4 Capacity plan output

```
Group         Head  Stocking  Pen cap  Stalls  Bunk-ft  Bunk in/cow
─────────────────────────────────────────────────────────────────
Fresh           18    100%       18      18      45         30
High           120    110%      132     132     330         30
Mid            100    115%      115     115     230         24
Low             80    115%       92      92     184         24
Close-up        24    100%       24      24      60         30
Far-off         36    100%       36      36      72         24
Hospital         8    100%        8       8      20         30
Maternity        6    100%        6       6      15         36
─────────────────────────────────────────────────────────────────
TOTAL                            431     431     956
```

Formula: `pen_cap = ceil(head × stocking_pct)`. Bunk-in/cow defaults from group class.

This becomes the **target** the user builds toward during Barn + Pen steps. Each step shows a running gauge ("Stalls 280 / 431 — 65% of plan").

---

## 4. Data model

### 4.1 Location & access

```
locations
  ├── manages_livestock  (bool)
  ├── manages_crops      (bool)
  ├── livestock_area_hectares
  ├── arable_area_hectares
  ├── timezone
  ├── setup_step         (wizard state)
  └── setup_completed_at

location_overrides       (nullable: currency, units, timezone — null = inherit ORG)
location_user_access     (user_id, location_id, per-section permissions matrix)
                         (supersedes the simple location_members)
```

### 4.2 Livestock side

```
herd_profile             (target counts: lact, dry, heifer, calf, % primip, calving interval)
groups                   (logical cohorts; CNCPS animal-description fields)
group_rules              (predicates: DIM range, yield range, parity, repro, BCS, cooldown)
capacity_plan_view       (computed: head × stocking% → stalls + bunk-ft per group)

barns
  ├── identity, parcel_id
  ├── type              (freestall / tie_stall / bedded_pack / compost / drylot / robotic /
  │                       parlor / calf / maternity_transition / hospital / heifer / hutches)
  ├── row_configuration (2-row / 3-row / 4-row / 6-row)
  ├── counts            (freestall_count, headlock_count, loafing_sqft, holding_capacity)
  ├── stalls            (surface, bedding, dimensions, neck-rail)
  ├── bunk              (type, total_linear_ft)
  ├── floor / manure
  ├── ventilation       (type, fan_count, fan_diameter, soakers)
  ├── cow comfort       (sprinklers, fans-over-stalls, brushes, footbath)
  └── parlor            (type, stalls, robot_count)

pens
  ├── name, code, barn_id
  ├── pen_type          (industry pen-type taxonomy: milking, dry, close_up, far_off, fresh,
  │                       hospital, maternity, AI, bull, heifer, calf)
  ├── side-effect flags (is_DRY, is_HOSP, is_FRESH — write events on entry)
  ├── capacity_head, current_head_count
  ├── default_group_id, tmr_recipe_id
  └── is_placeholder    (true for auto-created import pens awaiting reconciliation)
```

industry pen-type rules to enforce as DB CHECK constraints:

- `is_AI_pen` and `is_BULL_pen` are mutually exclusive.
- Entering a pen with `is_DRY_pen = true` auto-writes a dry-off event on the animal.
- Entering `is_HOSP_pen` auto-writes a hospital-pen date.
- Entering `is_FRESH_pen` auto-writes a fresh date.

### 4.3 Crops side (skippable entirely)

```
arable_parcels           (name, code, area_hectares, status — no geometry)
crop_plans               (parcel_id, crop_type, planted_at, planned_harvest, status)
crop_events              (planting / irrigation / fertilization / spray / scouting / harvest)
```

### 4.4 Animal data (the comprehensive event model)

```
animals                  (stable identity, lineage, breed, sex, origin, status)
lactations               (parity history)
test_days                (DHI test-day records)
milkings                 (per cow per milking — source-tagged)
daily_yields_view        (rollup; computed)
repro_events             (heat, breeding, preg check, abortion, DNB)
calvings                 (date, ease, twin, calf reference)
health_events            (diagnosis, treatment, drug, withdrawal end)
genomics                 (GTPI, PTAs, haplotypes)
scores                   (BCS, locomotion, weight, conformation)
pen_moves                (date, from, to, reason)
transactions             (purchase, sale, death, cull)
bulk_tank_readings
milk_diversions          (hospital / calves / waste / dump / spill)
milk_reconciliation_view (computed)
milk_pickup_tickets      (processor settlements)
milk_pricing_schemes     (effective-dated per LOC)
animal_yield_value_view  (yield × scheme = $/cow/day)
```

**Everything time-bound is an event.** The `animals` table holds only stable attributes; even an import-snapshot "Last Calving Date" lands as a row in `calvings` + `lactations`, never as a column on `animals`.

Every event row carries:

- `source` enum (`api / mobile / excel / manual`)
- `source_external_id` for idempotency on re-import

### 4.5 ORG-level catalogs

```
org_catalogs_breeds         (NAAB Uniform Breed Codes seed)
org_catalogs_diagnoses      (ICAR Section 7.1 dairy health codes)
org_catalogs_drugs          (with FARAD withdrawal references)
org_catalogs_routes         (IM / IV / SC / IMM / PO / Topical / IU)
org_catalogs_cull_reasons   (DHIA 9-code + ICAR cross-walk)
org_catalogs_naab_sires     (cached lookups)
org_group_strategy_presets
org_pricing_scheme_templates
org_capacity_defaults       (single row: stocking %, bunk-in defaults)
org_security_policy         (single row)
org_audit_log
```

---

## 5. Import template

**Anchored to ICAR ADE** (international standard) with **established herd-management systems column aliases** as a convenience layer. Vendor-neutral: a paper-records farmer sees the same template as a established herd-management software migrator.

### 5.1 Three tiers

| Tier | Files | Use case |
|---|---|---|
| Snapshot only | `animals.csv` (~38 columns) | Most farms. Paper records or generic software. Bootstraps groups + pens from current state alone. |
| Snapshot + recent history | + `lactations`, `repro_events`, `health_events`, `pen_moves` | Last ~12 months of events. |
| Full migration | + `test_days`, `calvings`, `genomics`, `scores`, `transactions`, `milkings`, `bulk_tank_readings` | established herd-management systems exports. Every byte preserved. |

### 5.2 `animals.csv` — the critical snapshot file

Six blocks of columns. The snapshot alone is sufficient to bootstrap groups + pens.

**Block 1 — Identity:** Animal ID, Name, Official ID (840/ISO/CCIA), Reg #, Breed, Sex, Birth Date, Markings.

**Block 2 — Origin:** Origin (Born on Farm / Purchased / Imported / Leased / Other), Source Farm, Entry Date, Purchase Price.

**Block 3 — Lineage:** Sire NAAB Code, Sire Name, Dam Animal ID (internal), Dam Tag (external), Recipient Dam ID, ET/IVF flag.

**Block 4 — Current state:** Status, Status Date, Current Pen, Current Lactation #, Last Calving Date, Reproductive Status, Last Breeding Date / Sire / Service #, Pregnancy Confirmed Date, Days Pregnant, Expected Calving Date, Dry-off Date.

**Block 5 — Current production** (drives group suggestion): Last 7-Day Avg Daily Milk + As-of Date, Last Test Date / Milk / Fat % / Protein % / SCC, 305-Day ME Milk, Peak Milk + DIM.

**Block 6 — Genetics + scoring shortcuts:** A2 Status, Polled, BCS, Locomotion, Notes.

**Bootstrap behavior** — with only `animals.csv` filled, on commit the app:

1. Counts herd composition (lact / dry / preg-heifer / open-heifer / calf).
2. Computes DIM distribution → Fresh / High / Mid / Low cutoffs.
3. Computes yield distribution → group thresholds at actual herd percentiles.
4. Calculates parity mix → first-lactation group sizing.
5. Calculates repro status mix → Close-up / Far-off counts.
6. Suggests a group strategy preset.
7. Fills rules from herd reality (not textbook defaults).
8. Computes capacity plan.
9. Places every animal into the suggested group on commit.

Snapshot columns land in proper event tables on import — never on `animals` itself:

- "Last 7-Day Avg Daily Milk" + "As-of Date" → `daily_yields_view` source rows
- "Last Test ..." → `test_days`
- "Last Breeding Date / Sire / Service #" → `repro_events`
- "Last Calving Date" → `calvings` + `lactations` (with `is_synthesized = true`)
- "Pregnancy Confirmed Date / Days Pregnant" → `repro_events` (preg check)
- "BCS / Locomotion" → `scores`

### 5.3 Optional history files

`lactations.csv`, `repro_events.csv`, `health_events.csv`, `pen_moves.csv`, `calvings.csv`, `test_days.csv`, `genomics.csv`, `scores.csv`, `transactions.csv`, `milkings.csv`, `bulk_tank_readings.csv`.

Each one-table-per-event-type. Join key is `Animal ID` (on-farm management number). Alternate keys (`Official ID`, `Registration Number`) are stored but never used for join.

### 5.4 Format

- Single **XLSX** with one sheet per file + README + Settings sheet + Vocabularies sheet, with Excel data-validation dropdowns on every controlled-vocab column.
- Same data also as **ZIP of CSVs** for power users / legacy exports.
- Both round-trip identically.

### 5.5 Vocabularies shipped with the template

Breeds (NAAB), Repro event types (industry ↔ ICAR cross-walk), Health event types (ICAR), Diagnoses (ICAR Section 7.1 Nordic NKM subset), Routes, Cull reasons (DHIA 9-code + ICAR), Semen types, Calving ease, BCS scale (Edmonson), Locomotion (Sprecher), Country ID formats (ISO 11784/3166-1).

### 5.6 Import flow

1. Download template — choose tier + format.
2. Fill it offline.
3. Upload — app detects file structure.
4. Column-mapping step (pre-filled if "Source: established herd-management systems").
5. Dry-run preview ("Will create 1,247 animals, 4,123 lactations, 18,455 events").
6. Validation errors shown for review. **Hard-reject** required-field violations; **soft-import** with warning report for non-required issues.
7. Commit.

### 5.7 Critical gotchas (locked into schema)

1. Recipient vs genetic dam are **separate columns** — never collapse.
2. NAAB sire codes are **strings** (format drifted 7→9 chars with zero-padding).
3. `withdrawal_milk_end` and `withdrawal_meat_end` are **persisted timestamps**, not computed on read (vet extra-label adjustments would be lost).
4. the conflated sold/died status code in legacy exports is split on import into `transactions.txn_type` (Sale / Death / Euthanized / ...) — don't carry the conflation forward.
5. `test_plan` lives **per test-day row**, not per lactation (farms switch mid-lactation).
6. Twin calves = two rows in `calvings.csv` with the same dam + date.
7. Freemartin is a real sex code.
8. Abortion (`icarReproAbortionEventResource`) is distinct from a parturition with `stillborn_flag = true`.

---

## 6. Milk recording, bulk-tank reconciliation, pricing

### 6.1 Recording profile (per LOC, set in wizard Step 1.5)

| Field | Options |
|---|---|
| Test-day recording frequency | None / Monthly / Fortnightly / Weekly |
| Daily individual recording | Yes / No |
| Milkings per day | 1× / 2× / 3× / Robotic-variable |
| Recording method | Parlor meters (ICAR-certified) / Walk-thru meters / Pail / Visual estimate / Mobile entry / Robotic |
| Bulk tank recording | Daily / Per pickup / None |
| Component sampling | DHI lab / Inline fat-protein / Bulk tank only |

Drives downstream:

- **Test-day only** → wizard's "Last 7-Day Avg Daily Milk" column becomes "Last Test-Day Milk." Daily-yield UI hidden.
- **Daily + 2×** → `milkings` table accepts 2 rows/cow/day. Mobile entry shows 2 input rows per pen.
- **Robotic** → expect 2.5–3.5 milkings/day with per-milking timestamps.

### 6.2 Ingestion paths (multi-select on the same step)

Same data model, three doors in:

| Path | What lands | When it ships |
|---|---|---|
| Excel/CSV bulk upload | `milkings`, `test_days`, `bulk_tank_readings` via the import template | PR-F.2 |
| Mobile companion (PWA, offline-first) | Per-cow yields, bulk tank readings, quick events, photos | PR-J |
| API integrations | Vendor webhooks → same tables | PR-K (Lely / DeLaval / GEA / Afimilk / ICAR ADE generic) |

Every milking carries `source` and `source_external_id` for idempotency. Re-imports never duplicate.

### 6.3 Bulk tank vs. individual reconciliation

Sum of cow meters always runs 3–7% above the tank reading (foam, wash water, calf milk, hospital diversions, calibration drift). The tank is **revenue truth**, individual meters are **cow-management truth** — both coexist.

```
bulk_tank_readings
  location_id, reading_date, volume_kg or volume_l,
  fat_pct, protein_pct, scc, temperature, source

milk_diversions          (allocation buckets so the delta is explainable)
  date, kg, bucket (hospital / calves / waste / dumped / spilled)

milk_reconciliation_daily   (computed view)
  date, sum_individual_kg, bulk_tank_kg,
  allocated_kg (sum of diversions),
  unexplained_kg, unexplained_pct
```

UI: a single daily reconciliation page — three numbers and a delta. Flag when `unexplained_pct > 5%` (configurable per location).

### 6.4 Milk pricing & correction

Lives in Settings (`/locations/[id]/milk-pricing`), not the wizard, because it changes over time and needs versioning.

**Correction methods supported:**

| Method | Formula | Use case |
|---|---|---|
| Raw | `milk_kg` (no correction) | Bulk-tank, no components |
| FCM 3.5% | `0.432 × milk + 16.23 × fat_kg` (Gaines) | DHI baseline |
| FCM 4.0% | `0.4 × milk + 15 × fat_kg` (Gaines) | EU dairy |
| ECM (NRC) | `0.327 × milk + 12.95 × fat_kg + 7.20 × protein_kg` | North America research |
| ECM (Tyrrell-Reid) | `0.327 × milk + 12.86 × fat_kg + 7.04 × protein_kg` | Alternative ECM |
| Milksolids (MS) | `fat_kg + protein_kg` | NZ / AU (Fonterra) |
| Total Solids (TS) | `fat + protein + lactose + ash` | Cheese pricing |
| Fat-corrected to base | `milk × (target_fat / actual_fat)` | India / Pakistan cooperatives (6% fat base) |
| SNF-corrected | `milk × (target_snf / actual_snf)` | India cooperatives |
| Custom formula | User-entered expression | Edge cases |

**Pricing scheme structure:**

```
milk_pricing_schemes (effective-dated, per location)
  ├── name, currency, effective_from, effective_to
  ├── base_unit             (kg / L / lb / cwt / MS-kg)
  ├── correction_method     (one of the above)
  ├── base_price_per_unit
  ├── component_bonuses     (json)
  │     ├── fat_per_0.1pct_per_unit
  │     ├── protein_per_0.1pct_per_unit
  │     ├── lactose, urea (optional)
  │     └── scc_tiers       [{max: 200_000, bonus: +X}, {max: 400_000, bonus: 0}, {max: inf, bonus: -Y}]
  ├── volume_tiers          [{min_kg, max_kg, multiplier}]
  └── quality_bonus_flat
```

**Country presets shipped at ORG level:**

- US — FMMO Class III: component pricing, fat/protein/other-solids, SCC adjustment.
- EU — generic component: € per kg-fat + € per kg-protein + base, SCC tier.
- NZ — Fonterra milksolids: per kg-MS, hygiene grade bonus.
- India — cooperative fat-correction: per L, 6% fat base, SNF correction (Amul-style).
- Pakistan — fat-correction: per L, 6% fat base.
- Custom: empty form.

**Surfaces:**

- `/locations/[id]/milk-pricing` — scheme history with effective dates. Adding a new scheme closes the previous one's window.
- Per-cow value reporting — cow's daily yield × current scheme = $/cow/day. Drives cull-candidate / ROI columns.
- Bulk tank settlement reconciliation — when a processor pickup ticket lands, app computes expected price using scheme + components, flags variance from processor's actual payment.

---

## 7. PR sequence

Each row is one PR, opened, merged, deployed before the next starts.

| PR | Scope | Unlocks |
|---|---|---|
| PR-A | Wizard shell + step machine. Location form gains module toggles + areas + timezone. Step 1 functional. | Location setup begins |
| PR-A.5 | **Settings IA reorg**: split `/settings` into `/account`, `/organization/*`, `/users`, `/locations/[id]/*`. Move existing pages into the new tree. No new features. | New IA in place |
| PR-A.6 | ORG-level seed catalogs (`org_capacity_defaults`, `org_pricing_scheme_templates`, `org_group_strategy_presets`, breeds, diagnoses) + `/organization/presets` page. | Catalogs scaffolded |
| PR-A.7 | `location_overrides` + inheritance helper (`resolveSetting(loc, key)`). Wires up currency/units/timezone inheritance with override toggles. | Inheritance live |
| PR-B | LOC `/recording` (Recording profile, Step 1.5). | Recording model captured |
| PR-C | LOC `/groups` Herd profile + Group strategy + Rules + Capacity plan (Steps 3–6). | Logical design complete |
| PR-D | LOC `/infrastructure` Barns (Step 7) + plan-vs-actual gauge. | Physical barn modeling |
| PR-E | LOC `/infrastructure` Pens (Step 8) — established herd-management software pen-type flags + AI/BULL exclusion + group assignment. | Greenfield setup fully functional |
| PR-F.0 | Comprehensive animal-data schema: all event tables (`animals`, `lactations`, `test_days`, `milkings`, `repro_events`, `calvings`, `health_events`, `genomics`, `scores`, `pen_moves`, `transactions`, `bulk_tank_readings`, `milk_diversions`) + vocab tables + RLS + indexes. No UI. | Foundation for import |
| PR-F.1 | Template generator: download XLSX + ZIP with vocab sheets and validation dropdowns. | Users can fill offline |
| PR-F.2 | Importer: upload → column-map UI → dry-run preview → commit. Snapshot-driven bootstrap wired into wizard Step 2a. | Migration path works |
| PR-F.3 | established herd-management systems column-alias presets. | One-click migration |
| PR-G | LOC arable parcels (Step 9). | Crops module visible |
| PR-L | LOC `/milk-pricing` + pricing reconciliation. | Revenue tracking |
| PR-M | LOC `/bulk-tank` + reconciliation page + diversion allocation UI. | Tank vs. cow reconciled |
| PR-N | Per-milking entry forms on web (parlor staff workflow). | Manual daily recording |
| PR-H | Rule runtime engine (background auto-assignment, wrong-pen prompt, cooldown). | Rules go live |
| PR-I | Crop plans + crop events on arable parcels. | Crops fully functional |
| PR-O | LOC `/access` (per-section permissions matrix — supersedes flat `location_members`). | Fine-grained access control |
| PR-P | ORG `/security`, `/billing`, `/audit`. | Enterprise readiness |
| PR-Q | LOC `/directories` (technicians / vets / trimmers), `/notifications`, `/integrations` (scaffolding only). | Per-farm people + alerts |
| PR-J | Mobile PWA companion — offline-first quick-entry for yields, tank, events. | Parlor / field workflow |
| PR-K | API integrations — ICAR ADE receiver, then Lely / DeLaval / GEA / Afimilk. | Automated ingestion |

**Phase milestones:**

- After **PR-E**: greenfield livestock farms are fully usable.
- After **PR-F.3**: migration from established herd-management systems / paper / generic software works.
- After **PR-I**: the full product is in place for livestock + crops.
- After **PR-Q**: enterprise-grade access, notifications, integrations scaffolded.
- After **PR-K**: automated ingestion live.

---

## 8. Decisions log

| # | Decision | Choice |
|---|---|---|
| 1 | Modules toggle | Per-location: `manages_livestock`, `manages_crops` |
| 2 | Land model | Name + area only — no map polygons in v1 |
| 3 | Order of setup | Groups → Rules → Capacity plan → Barns → Pens (logical before physical) |
| 4 | Group library | Single / 2-group / 3-group / 4-group lactating presets + always-on Fresh/Hospital/Maternity + Heifer/Calf splits by herd size |
| 5 | Default rules | DIM ranges (textbook) + yield percentiles (derived from import) + parity / repro / BCS predicates |
| 6 | Barn fields | Full Dairyland Initiative / UMN / Cornell set (type, row config, counts, stalls, bunk, ventilation, cow comfort, floor, parlor) |
| 7 | Pen fields | industry pen-type taxonomy + side-effect flags (AI/BULL exclusive; DRY/HOSP/FRESH auto-write events) |
| 8 | Import path | Two paths: greenfield (typed counts) vs migration (animals.csv first → app profiles herd → suggests groups) |
| 9 | Template anchor | ICAR ADE + established herd-management systems column aliases |
| 10 | Template tiers | Snapshot-only / + recent history / full migration |
| 11 | Template format | XLSX (default) and ZIP-of-CSVs (power users) — both round-trip identically |
| 12 | Snapshot-driven bootstrap | `animals.csv` alone is sufficient to suggest groups + place animals |
| 13 | Animal data model | `animals` = stable attributes; everything time-bound is an event |
| 14 | Vendor lock-in | None — template is generic. established herd-management systems compatibility is a convenience layer, not a requirement |
| 15 | Recording profile lives in the wizard | Yes — Step 1.5, mandatory |
| 16 | Three ingestion paths share one model | Excel / Mobile / API → same `milkings` table, `source` tagged |
| 17 | Bulk-tank kept separately from individual | Yes — own table + daily reconciliation view |
| 18 | Pricing scheme is effective-dated, lives in Settings | Yes — not wizard |
| 19 | Correction methods supported | Raw / FCM 3.5 / FCM 4 / ECM (NRC) / ECM (T-R) / MS / TS / India-fat / India-SNF / Custom |
| 20 | Country presets shipped | US FMMO / EU component / NZ Fonterra / India cooperative / Pakistan / Custom |
| 21 | Mobile + API are post-PR-I phases | Yes — file imports + manual web entry come first |
| 22 | Three-level settings model | ORG defaults → LOC overrides → USER personalizes |
| 23 | Catalogs (breeds, diagnoses, drugs, presets) | ORG-level, with per-LOC custom additions |
| 24 | Capacity & stocking defaults | ORG defaults, LOC override |
| 25 | Currency / units / timezone | ORG default, LOC override; USER display preference only |
| 26 | Pricing scheme templates vs instances | Template at ORG, instantiated per LOC with effective dating |
| 27 | Audit log scope | ORG-level, filterable by LOC |
| 28 | Settings IA | `/account` (USER), `/organization/*` (ORG), `/users` (ORG), `/locations/[id]/*` (LOC) |
| 29 | Active-location scope | All `/locations/[id]/*` subtree scoped via the switcher |
| 30 | Per-section user permissions | Replaces simple `location_members`; matrix lives at LOC |

---

## 9. Open decisions (still to lock before PR-A)

| # | Question | Recommendation |
|---|---|---|
| 1 | Hard-reject vs soft-import validation on bad rows? | Hard-reject required-field violations; soft-import + warning report for everything else |
| 2 | "Skip" banner scope after wizard exit? | Only on the Location overview page, not on every sub-page |
| 3 | Unit storage internally? | Hectares (numeric) for area; kg for mass; L for volume. UI converts for display |
| 4 | `manages_crops = false` nav behavior? | Hide Crops nav entirely (not greyed) |
| 5 | Capacity-plan stocking defaults? | Fresh 100% / High 110% / Mid 115% / Low 115% / Dry-close 100% / Dry-far 110% — adjustable per group |
| 6 | Default seed groups in presets? | Single / 2 / 3 / 4 lactating + always-on Fresh + Hospital + Maternity + Heifer (split by herd size) + Calf |
| 7 | Robotic-AMS preset? | Defer to v2; cover with "Custom" preset for now |
