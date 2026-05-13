import {
  Location01Icon,
  Settings01Icon,
  ClipboardClockIcon,
  BarnsIcon,
  GroupLayersIcon,
  DollarCircleIcon,
  ApiIcon,
  Notification02Icon,
  ContactBookIcon,
  Notebook01Icon,
  ShieldUserIcon,
  DownloadCircle01Icon,
  PolyTankIcon,
  ChartLineData02Icon,
  MedicalFileIcon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";

type HugeIcon = typeof Location01Icon;

export type LocationSection = {
  slug: "" | string;
  label: string;
  description: string;
  icon: HugeIcon;
  shipped: boolean;
  group: LocationSectionGroup;
  livestockOnly?: boolean;
  cropsOnly?: boolean;
};

export type LocationSectionGroup =
  | "overview"
  | "setup"
  | "herd"
  | "milk"
  | "infrastructure"
  | "access"
  | "operations"
  | "system";

export const LocationSectionGroupLabels: Record<
  LocationSectionGroup,
  string | null
> = {
  overview: null,
  setup: "Setup",
  herd: "Herd setup",
  milk: "Milk & quality",
  infrastructure: "Infrastructure",
  access: "People & access",
  operations: "Operations",
  system: "System",
};

export const LocationSectionGroupOrder: LocationSectionGroup[] = [
  "overview",
  "setup",
  "herd",
  "milk",
  "infrastructure",
  "access",
  "operations",
  "system",
];

/**
 * Subnav catalog for /settings/locations/[id]/*.
 *
 * Mirrors Bovisync herd-setup tabs and DC305 SETUP commands. Settings
 * is configuration only — operational data (Animals roster, Milk
 * recording entry, Bulk-tank readings, Crop events) lives at top-level
 * routes off the main sidebar.
 */
export const LocationSections: LocationSection[] = [
  {
    slug: "",
    label: "Overview",
    description: "Status snapshot for this location.",
    icon: Location01Icon,
    shipped: true,
    group: "overview",
  },

  {
    slug: "general",
    label: "General",
    description: "Identity, modules, areas, timezone, overrides.",
    icon: Settings01Icon,
    shipped: true,
    group: "setup",
  },

  {
    slug: "groups",
    label: "Herd structure",
    description: "Herd profile, group strategy, rules, capacity plan.",
    icon: GroupLayersIcon,
    shipped: true,
    group: "herd",
    livestockOnly: true,
  },
  {
    slug: "reproduction",
    label: "Reproduction",
    description:
      "VWP, heat detection, preg-check schedule, dry-off / close-up triggers, KPI targets.",
    icon: ChartLineData02Icon,
    shipped: true,
    group: "herd",
    livestockOnly: true,
  },
  {
    slug: "health",
    label: "Health protocols",
    description:
      "Vaccination schedule, hoof-trim cadence, treatment protocols.",
    icon: MedicalFileIcon,
    shipped: false,
    group: "herd",
    livestockOnly: true,
  },

  {
    slug: "recording",
    label: "Milk recording setup",
    description:
      "Test-day frequency, milkings/day, recording method, component sampling.",
    icon: ClipboardClockIcon,
    shipped: true,
    group: "milk",
    livestockOnly: true,
  },
  {
    slug: "quality-withdrawal",
    label: "Quality & withdrawal",
    description:
      "SCC thresholds, component targets, withdrawal policy, herd-level targets.",
    icon: ShieldUserIcon,
    shipped: true,
    group: "milk",
    livestockOnly: true,
  },
  {
    slug: "milk-pricing",
    label: "Milk pricing",
    description: "Pricing schemes with effective dates.",
    icon: DollarCircleIcon,
    shipped: true,
    group: "milk",
    livestockOnly: true,
  },
  {
    slug: "bulk-tank-settings",
    label: "Bulk-tank settings",
    description: "Reconciliation threshold and pickup cadence.",
    icon: PolyTankIcon,
    shipped: true,
    group: "milk",
    livestockOnly: true,
  },

  {
    slug: "infrastructure",
    label: "Infrastructure",
    description: "Barns, pens, arable parcels.",
    icon: BarnsIcon,
    shipped: true,
    group: "infrastructure",
  },

  {
    slug: "directories",
    label: "Directories",
    description: "Technicians, veterinarians, hoof trimmers.",
    icon: ContactBookIcon,
    shipped: true,
    group: "access",
  },
  {
    slug: "access",
    label: "Access",
    description: "Users who can access this location + permissions.",
    icon: ShieldUserIcon,
    shipped: true,
    group: "access",
  },

  {
    slug: "operations",
    label: "Operations",
    description: "Milking shifts, holiday calendar, feed cost.",
    icon: Calendar03Icon,
    shipped: false,
    group: "operations",
    livestockOnly: true,
  },

  {
    slug: "notifications",
    label: "Notifications",
    description: "Event-trigger rules for this location.",
    icon: Notification02Icon,
    shipped: false,
    group: "system",
  },
  {
    slug: "integrations",
    label: "Integrations",
    description: "API keys, webhooks, import history.",
    icon: ApiIcon,
    shipped: false,
    group: "system",
  },
  {
    slug: "import",
    label: "Data import",
    description: "Bulk-import animals, lactations, repro, health, etc.",
    icon: DownloadCircle01Icon,
    shipped: false,
    group: "system",
  },
  {
    slug: "custom-vocabularies",
    label: "Custom vocabularies",
    description: "Local additions to organization catalogs.",
    icon: Notebook01Icon,
    shipped: false,
    group: "system",
  },
];

export function relevantLocationSections(opts: {
  manages_livestock: boolean;
  manages_crops: boolean;
}): LocationSection[] {
  return LocationSections.filter((s) => {
    if (s.livestockOnly && !opts.manages_livestock) return false;
    if (s.cropsOnly && !opts.manages_crops) return false;
    return true;
  });
}

export function pathForLocationSection(
  locationId: string,
  section: LocationSection,
): string {
  const base = `/settings/locations/${locationId}`;
  return section.slug ? `${base}/${section.slug}` : base;
}
