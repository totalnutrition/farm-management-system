# Insight — Coding & Design Guidelines

These are the conventions for **Insight**, the Next.js 16 + Supabase farm management system at `c:/0-projects/farm-management-system`. Read this before adding any feature. Match what already exists; the existing code is the spec.

## Stack — locked

- Next.js `16.2.4` App Router, React `19.2.4`, TypeScript strict
- Tailwind **v4** (`@tailwindcss/postcss`, `tw-animate-css`) — not v3, no `tailwindcss-animate`
- shadcn/ui (Radix primitives) for components — extend the set in [components/ui/](../components/ui/) when needed
- `@supabase/ssr` + `@supabase/supabase-js` — **never `@supabase/auth-helpers-nextjs`**
- `react-hook-form` + `zod` + `@hookform/resolvers` for forms
- `sonner` for toasts, `next-themes` for dark mode
- **Icons**: `@hugeicons/react` + `@hugeicons/core-free-icons` only. Do not add `lucide-react`, `@tabler/icons-react`, or `react-icons`.
- **Fonts**: Geist Sans, Geist Mono, Outfit (`--font-sans`), Inter (`--font-heading`) — already wired in [app/layout.tsx](../app/layout.tsx). Don't add more.

Don't add a new dependency without a screen that demonstrably needs it. `@tanstack/react-table`, `date-fns`, `class-variance-authority`-as-an-abstraction-layer, etc. are not in the stack — the shadcn `<Table>` and `Intl.*` cover current needs.

## Directory layout

```
app/
  layout.tsx                 -- root: fonts, ThemeProvider, Toaster, metadata template (Insight branding)
  login/                     -- public: page.tsx + login-form.tsx + actions.ts
  logout/actions.ts          -- server action only
  (app)/                     -- authed route group; layout.tsx gates with getUser() + redirect
    layout.tsx               -- SidebarProvider + AppSidebar; do not duplicate this gate downstream
    page.tsx                 -- dashboard home
    admin/
      layout.tsx             -- requireAnyRole(["super_admin", "admin"])
      <area>/
        page.tsx              -- server: query + render <AreaTable/>
        <area>-table.tsx      -- "use client": shadcn Table + Create/Edit/Delete dialogs
        actions.ts            -- "use server": create/update/delete returning { error?, success? }
components/
  ui/*                       -- shadcn primitives only
  app-sidebar.tsx            -- the single sidebar; extend its MENU array
  theme-provider.tsx
hooks/                       -- only project-specific hooks (use-mobile.ts pattern)
lib/
  misc.ts                    -- Path* and Role* constants, RoleView lookup
  utils.ts                   -- cn() only
  types.ts                   -- shared cross-feature types
  supabase-client.ts         -- createBrowserClient — for "use client"
  supabase-server.ts         -- createServerClient(cookies()) — for server components / actions
  supabase-admin.ts          -- service-role client — for server actions that need to bypass RLS
  supabase-auth.ts           -- getCurrentUser, requireUser, requireRole, requireAnyRole, role/org getters
  supabase-proxy.ts          -- session refresh + login redirect (called from proxy.ts)
proxy.ts                     -- Next.js 16's middleware (renamed). Do not create middleware.ts.
scripts/                     -- one-off node scripts (run via npm run <name>)
supabase/migrations/         -- numbered SQL files: 0001_*, 0002_*, ...
docs/                        -- this file lives here
```

**Do not introduce**: `module/`, `services/`, `repositories/`, `lib/supabase/` (subfolder), `src/`, a `view.tsx`/`client.tsx`/`controller.ts` per-route trinity. The flat structure is the convention.

## Routing & auth

- All authed pages live under [app/(app)/](<../app/(app)/>). The `(app)` group's [layout.tsx](<../app/(app)/layout.tsx>) calls `supabase.auth.getUser()` and redirects to `PathLogin` if absent — **don't repeat this check in child layouts/pages**.
- For role-restricted areas, add a folder-level `layout.tsx` that calls `requireAnyRole([...])` (see [app/(app)/admin/layout.tsx](<../app/(app)/admin/layout.tsx>)). This is the **only** auth-gating pattern. No client-side `<AuthCheck>` wrapper, no per-page guard.
- Server-side, always use `supabase.auth.getUser()` (verifies the JWT). Never trust `getSession()` server-side.
- Pages that read cookies must export `export const dynamic = "force-dynamic"`.
- Login redirect logic stays in [lib/supabase-proxy.ts](../lib/supabase-proxy.ts). If you need to gate routes by role at the proxy layer, extend that file — don't fork it.

## Data layer — no wrapper, just Supabase

Use `supabase.from(...)` directly. There is **no** `getRecord` / `getRecords` / `createRecord` / `updateRecord` abstraction, no `APPID`, no `generateID`. Don't add one.

- **Reads in server components**: `createClient(await cookies())` from [lib/supabase-server.ts](../lib/supabase-server.ts) — RLS applies, scoped to the user.
- **Reads in client components**: `createClient()` from [lib/supabase-client.ts](../lib/supabase-client.ts).
- **Writes in server actions**: usually `createAdminClient()` from [lib/supabase-admin.ts](../lib/supabase-admin.ts), *after* a `requireAnyRole` check in the action. RLS is the security boundary; the admin client just lets the action run from a service context.
- Do **not** duplicate role checks into route handlers when RLS already enforces them. Only escape RLS for genuine admin operations (cross-org reads, count queries that need full visibility).

## Multi-tenancy — non-negotiable

Every domain row carries `organization_id uuid references public.organizations(id)`. The `profiles` table maps each user to one org. RLS uses `public.auth_role()` and `public.auth_org_id()` (defined in [supabase/migrations/0001_init_user_management.sql](../supabase/migrations/0001_init_user_management.sql)) — JWT `app_metadata.role` and `app_metadata.organization_id`.

When adding a table:
- Set `organization_id` on insert from `getOrganizationIdFromUser(user)`.
- Reject inserts where the caller has no org (super_admin is the only exception, and they need an explicit org chosen).
- RLS rejects cross-org access without app code involvement.

## Roles

Defined in:
- Postgres: `user_role` enum in `0001_init_user_management.sql`. Extend with `alter type user_role add value if not exists '<role>';` in a new migration. **Do not rewrite the enum.**
- TypeScript: `UserRole` union in [lib/supabase-auth.ts](../lib/supabase-auth.ts) — widen the union when you add an enum value.
- Constants: `RoleSuperAdmin`, `RoleAdmin`, etc. in [lib/misc.ts](../lib/misc.ts). Add a corresponding entry in `RoleView` for the human label.

Reference roles via the constant, never the string literal: `requireAnyRole([RoleSuperAdmin, RoleAdmin])`, not `requireAnyRole(["super_admin", "admin"])`.

## Migrations

- Numbered `NNNN_short_description.sql` in [supabase/migrations/](../supabase/migrations/). Always increment.
- Idempotent: `create table if not exists`, `drop policy if exists` then `create policy`, `add column if not exists`, `alter type ... add value if not exists`.
- Every domain table includes:
  ```sql
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
  ```
  Plus a `before update` trigger that calls `public.set_updated_at()` and an index on `organization_id`.
- Enable RLS on every table. Default policy shape:
  - **select**: `public.auth_role() = 'super_admin' OR organization_id = public.auth_org_id()`
  - **insert/update**: same, *plus* role check for write-allowed roles
  - **delete**: tighter — usually super_admin + admin only
- After a migration, regenerate types: `npx supabase gen types typescript --linked > lib/database.types.ts` and thread `Database` through the supabase clients.

## Per-feature file pattern

For a new domain area `<area>` (e.g. `farms`, `tasks`):

```
app/(app)/<area>/
  layout.tsx          -- only if role-gating is needed beyond the (app) gate
  page.tsx            -- server component, queries via createClient/createAdminClient, renders <AreaTable rows={...} canX={...} />
  <area>-table.tsx    -- "use client", shadcn <Table> + CreateDialog + EditDialog + DeleteDialog
  actions.ts          -- "use server", create/update/delete actions
```

Reference implementations:
- Listings + dialog CRUD: [app/(app)/admin/organizations/](<../app/(app)/admin/organizations/>) (organizations-table.tsx + actions.ts)
- Public form: [app/login/login-form.tsx](../app/login/login-form.tsx)

When an entity has more than ~6 fields and the dialog feels cramped, *only then* split into a dedicated `app/(app)/<area>/[id]/page.tsx` edit route. Don't speculatively pre-split.

## Forms

- Use `react-hook-form` + `zodResolver`.
- Use shadcn `<Form>` / `<FormField>` / `<FormItem>` / `<FormLabel>` / `<FormControl>` / `<FormMessage>` for new CRUD (organizations style).
- The `<Field>` / `<Controller>` style in [login-form.tsx](../app/login/login-form.tsx) is reserved for login; don't propagate it.
- Submit via `useTransition`: call the server action, then `toast.success(...)` on `success` or `toast.error(result.error)` on error.
- Reset and close dialog on success; never close on error.

## Server actions

```ts
"use server";

export async function createX(input: z.infer<typeof schema>): Promise<Result> {
  await requireAnyRole([RoleAdmin, RoleFarmManager]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin.from("x").insert({ ...parsed.data, organization_id: orgId });
  if (error) return { error: error.message };

  revalidatePath(PathX);
  return { success: true };
}
```

Rules:
- Always `requireAnyRole` first.
- Always `safeParse` — return the first issue message.
- Result type is `{ error?: string; success?: boolean }` — don't invent new shapes.
- Always `revalidatePath` the affected list page.
- Don't catch and re-throw. Don't log. Let the error message reach the toast.

## Sidebar

[components/app-sidebar.tsx](../components/app-sidebar.tsx) drives navigation. Adding a new area = adding an entry to its `MENU` array with:
- a Hugeicon (e.g. `Tractor01Icon`, `PlantIcon`) — pick from `@hugeicons/core-free-icons`
- the `Path*` constant from `lib/misc.ts`
- the `roles: [...]` array (uses the `Role*` constants)

Group label is uppercase-ish, label-cased on screen. Don't introduce a separate `nav.tsx` or breadcrumb component — the sidebar is the navigation surface today.

## Naming

- **Files & folders**: `kebab-case` (`farms-table.tsx`, `crop-cycles/`, `supabase-auth.ts`).
- **React components**: `PascalCase`, un-prefixed (`FarmsTable`, not `ViewCUFarm`, not `ViewFarmsTable`).
- **Hooks**: `useCamelCase` in `.ts` or `.tsx`.
- **Constants**: `PascalCase` for grouped logical constants — `PathFarms`, `RoleAdmin`, `RoleView`. `UPPER_SNAKE_CASE` only for plain string-literal messages.
- **Server actions**: `camelCase` verbs — `createFarm`, `updateFarm`, `deleteFarm`.
- **Tables**: snake_case singular-or-plural to match Postgres convention already set (`organizations`, `profiles`).

## Branding — do not change

- Product name is **Insight**, full title `Insight: Farm Managemnt System by Total Nutrition` (typo preserved — don't "fix" it without asking).
- Title template in [app/layout.tsx](../app/layout.tsx) stays as-is.
- Logo is [public/insight-dark.png](../public/insight-dark.png) / [public/insight-light.jpeg](../public/insight-light.jpeg).
- Sidebar header reads `FARM MANAGEMENT SYSTEM`.

## Style

- Tailwind utility classes inline. Compose with `cn()` from [lib/utils.ts](../lib/utils.ts).
- Dark mode is `class`-based (`next-themes`). Use semantic tokens (`text-muted-foreground`, `bg-background`, `ring-foreground/10`) over raw colors.
- Body text defaults to `text-xs` / `text-sm` in dense areas (tables, dialogs); headings use `font-heading`.

## Comments

Default to none. Only add a comment when the *why* is non-obvious — a hidden constraint, a workaround, a subtle invariant. **Never** write file-level JSDoc, never explain *what* code does, never reference tasks/PRs/issues in comments. Match the silence in the existing files.

## Before claiming done

- `npm run build` — fix every type error.
- `npm run lint` — fix every warning.
- `npm run dev` (port 9000) — manually exercise the create / edit / delete path of any new screen.
- Confirm RLS rejects cross-org access (a quick admin-impersonation check in the SQL editor is enough).

## Committing — Claude Code Web

This repo is connected to GitHub. **When the work for a turn is complete, commit and push directly to `main`** — do not leave the user to do it manually, and do not open a pull request:

- Commit and push to `main` directly. Do **not** create a feature branch, do **not** open a PR. The workflow here is auto-commit to `main`.
- Stage only the files you changed (`git add <paths>`); never `git add -A` or `git add .` blindly.
- Never commit secrets — `.env*`, service-role keys, anything matching `*key*`, `*secret*`, `*token*`. If a tool stages one accidentally, unstage it before committing.
- Write one commit per logical change. Subject line ≤ 72 chars, imperative mood (`Add livestock CRUD`, not `Added` / `Adds`). If the change needs explanation, add a blank line and a body.
- Don't amend or force-push. Don't skip hooks (`--no-verify`). If a pre-commit hook fails, fix the underlying issue and create a new commit.
- After committing, `git pull --rebase origin main` to incorporate any remote changes, then `git push origin main` so the user sees the change in GitHub.
- If migrations were added, mention them in the commit body so reviewers know to run them.
- If you couldn't finish (build failing, tests failing, etc.), **don't commit** — surface the blocker to the user instead.
