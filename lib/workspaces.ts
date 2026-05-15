import {
  DashboardSquare01Icon,
  AlertCircleIcon,
  SpermIcon,
  MedicalFileIcon,
  ClipboardClockIcon,
  CookBookIcon,
  WheatIcon,
  Package01Icon,
  ChartLineData02Icon,
  AlarmClockIcon,
  Notebook01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { CowFaceIcon } from "@/lib/custom-icons";
import { RoleAdmin, RoleSuperAdmin } from "@/lib/misc";

type HugeIcon = typeof DashboardSquare01Icon;

const ROLES = [RoleSuperAdmin, RoleAdmin];

export type WorkspaceTab = {
  slug: string;
  label: string;
  /** Route this tab points at. Existing routes are reused as-is. */
  href: string;
};

export type Workspace = {
  key: string;
  label: string;
  icon: HugeIcon;
  /** Primary landing route for the workspace. */
  href: string;
  /** Secondary pages, rendered as an in-page tab bar. Empty = no tabs. */
  tabs: WorkspaceTab[];
  roles: string[];
  /**
   * Prefixes that belong to this workspace for active-state detection.
   * Defaults to [href] + every tab href.
   */
  match?: string[];
};

/**
 * The 12 workspaces + Settings. Replaces the old 33-line flat sidebar.
 * Each workspace owns a set of existing routes surfaced as tabs, so no
 * route is deleted — navigation just collapses.
 */
export const WORKSPACES: Workspace[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: DashboardSquare01Icon,
    href: "/",
    tabs: [],
    roles: ROLES,
    match: ["/"],
  },
  {
    key: "hot-list",
    label: "Hot list",
    icon: AlertCircleIcon,
    href: "/hot-list",
    tabs: [
      { slug: "alerts", label: "Alerts", href: "/hot-list" },
      { slug: "calendar", label: "Calendar", href: "/calendar" },
    ],
    roles: ROLES,
  },
  {
    key: "herd",
    label: "Herd",
    icon: CowFaceIcon,
    href: "/animals",
    tabs: [
      { slug: "animals", label: "Animals", href: "/animals" },
      { slug: "group-moves", label: "Group moves", href: "/group-moves" },
      { slug: "pen-moves", label: "Pen moves", href: "/pen-moves" },
    ],
    roles: ROLES,
  },
  {
    key: "rounds",
    label: "Rounds",
    icon: ClipboardClockIcon,
    href: "/rounds",
    tabs: [],
    roles: ROLES,
  },
  {
    key: "reproduction",
    label: "Reproduction",
    icon: SpermIcon,
    href: "/reproduction",
    tabs: [
      { slug: "overview", label: "Overview", href: "/reproduction" },
      { slug: "heats", label: "Heats", href: "/heats" },
      { slug: "breedings", label: "Breedings", href: "/breedings" },
      { slug: "preg-checks", label: "Preg checks", href: "/preg-checks" },
      { slug: "calvings", label: "Calvings", href: "/calvings" },
    ],
    roles: ROLES,
  },
  {
    key: "health",
    label: "Health",
    icon: MedicalFileIcon,
    href: "/health",
    tabs: [
      { slug: "overview", label: "Overview", href: "/health" },
      { slug: "vaccinations", label: "Vaccinations", href: "/vaccinations" },
      { slug: "withdrawals", label: "Withdrawals", href: "/withdrawals" },
    ],
    roles: ROLES,
  },
  {
    key: "milk",
    label: "Milk",
    icon: ClipboardClockIcon,
    href: "/milk",
    tabs: [
      { slug: "overview", label: "Overview", href: "/milk" },
      { slug: "recording", label: "Recording", href: "/milk-recording" },
      { slug: "test-days", label: "Test days", href: "/test-days" },
    ],
    roles: ROLES,
  },
  {
    key: "feed",
    label: "Feed",
    icon: CookBookIcon,
    href: "/feeding",
    tabs: [
      { slug: "overview", label: "Overview", href: "/feeding" },
      { slug: "recipes", label: "Recipes", href: "/recipes" },
      { slug: "refusals", label: "Refusals", href: "/refusals" },
      { slug: "feeds", label: "Feeds on hand", href: "/feeds" },
    ],
    roles: ROLES,
  },
  {
    key: "crops",
    label: "Crops",
    icon: WheatIcon,
    href: "/crops",
    tabs: [],
    roles: ROLES,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: Package01Icon,
    href: "/stocks",
    tabs: [
      { slug: "stocks", label: "Stocks", href: "/stocks" },
      { slug: "semen", label: "Semen", href: "/semen-inventory" },
      { slug: "procurement", label: "Purchasing", href: "/procurement" },
    ],
    roles: ROLES,
  },
  {
    key: "finance",
    label: "Finance",
    icon: ChartLineData02Icon,
    href: "/transactions",
    tabs: [],
    roles: ROLES,
  },
  {
    key: "people",
    label: "People",
    icon: AlarmClockIcon,
    href: "/people",
    tabs: [
      { slug: "overview", label: "Overview", href: "/people" },
      { slug: "attendance", label: "Attendance", href: "/attendance" },
      { slug: "payroll", label: "Payroll", href: "/payroll" },
    ],
    roles: ROLES,
  },
  {
    key: "reports",
    label: "Reports",
    icon: Notebook01Icon,
    href: "/reports",
    tabs: [],
    roles: ROLES,
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings02Icon,
    href: "/settings",
    tabs: [],
    roles: ROLES,
    match: ["/settings"],
  },
];

function matchPrefixes(w: Workspace): string[] {
  if (w.match) return w.match;
  const set = new Set<string>([w.href, ...w.tabs.map((t) => t.href)]);
  return Array.from(set);
}

/** Find the workspace that owns a given pathname. */
export function workspaceForPath(pathname: string): Workspace | null {
  // Exact root only matches Dashboard.
  if (pathname === "/") {
    return WORKSPACES.find((w) => w.key === "dashboard") ?? null;
  }
  let best: { w: Workspace; len: number } | null = null;
  for (const w of WORKSPACES) {
    if (w.key === "dashboard") continue;
    for (const p of matchPrefixes(w)) {
      if (p === "/") continue;
      if (pathname === p || pathname.startsWith(p + "/")) {
        if (!best || p.length > best.len) best = { w, len: p.length };
      }
    }
  }
  return best?.w ?? null;
}

