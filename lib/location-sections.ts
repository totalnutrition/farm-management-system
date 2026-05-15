import {
  Location01Icon,
  Settings01Icon,
  ClipboardClockIcon,
  BarnsIcon,
  GroupLayersIcon,
  Coins01Icon,
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
  TruckIcon,
  PackageIcon,
  ChefHatIcon,
  Restaurant01Icon,
  TestTubeIcon,
  ThermometerIcon,
  AlertCircleIcon,
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
  | "feeding"
  | "infrastructure"
  | "purchasing"
  | "access"
  | "operations"
  | "system";

export const LocationSectionGroupLabels: Record<
  LocationSectionGroup,
  string | null
> = {
  overview: null,
  setup: "Farm profile",
  herd: "Herd & targets",
  milk: "Milk setup",
  feeding: "Feeding",
  infrastructure: "Infrastructure",
  purchasing: "Contacts",
  access: "Access",
  operations: "Operations",
  system: "System",
};

export const LocationSectionGroupOrder: LocationSectionGroup[] = [
  "overview",
  "setup",
  "herd",
  "milk",
  "feeding",
  "infrastructure",
  "purchasing",
  "access",
  "operations",
  "system",
];

/**
 * Subnav catalog for /settings/locations/[id]/*.
 *
 * Settings = configuration only. Operational data (per-cow events,
 * feeding events, lab tests, environmental readings) lives at the
 * top-level operational routes off the main sidebar.
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
    slug: "playbook",
    label: "Operations playbook",
    description:
      "Active strategies, protocols, KPIs and schedules — one place.",
    icon: ClipboardClockIcon,
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
    description: "Group strategy + the rules the engine moves cows by.",
    icon: GroupLayersIcon,
    shipped: true,
    group: "herd",
    livestockOnly: true,
  },
  {
    slug: "kpis",
    label: "KPIs & targets",
    description:
      "One home for every target — stocking %, bunk space, PR21, CR, SCC, DMI, refusal, days-open. The Hot list + engines read from here.",
    icon: ChartLineData02Icon,
    shipped: true,
    group: "herd",
    livestockOnly: true,
  },
  {
    slug: "reproduction",
    label: "Reproduction setup",
    description:
      "VWP, heat detection, preg-check schedule. (Targets live in KPIs; protocol selection in Playbook.)",
    icon: ChartLineData02Icon,
    shipped: true,
    group: "herd",
    livestockOnly: true,
  },
  {
    slug: "health",
    label: "Health protocols",
    description:
      "Vaccination schedule, hoof-trim cadence, per-diagnosis treatments.",
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
      "SCC thresholds, component targets, withdrawal policy, herd targets.",
    icon: ShieldUserIcon,
    shipped: true,
    group: "milk",
    livestockOnly: true,
  },
  {
    slug: "milk-pricing",
    label: "Milk sales",
    description:
      "Sales contracts, effective-dated pricing schemes, component bonuses, SCC tiers.",
    icon: Coins01Icon,
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
    slug: "recipes",
    label: "TMR recipes",
    description: "Ration formulations consumed by feeding events.",
    icon: ChefHatIcon,
    shipped: false,
    group: "feeding",
    livestockOnly: true,
  },
  {
    slug: "feeding-schedule",
    label: "Feeding schedule",
    description:
      "Per-group TMR delivery times, bunk push-up frequency, feed cost.",
    icon: Restaurant01Icon,
    shipped: false,
    group: "feeding",
    livestockOnly: true,
  },
  {
    slug: "storage",
    label: "Storage",
    description: "Silos, bins, freezers. Drives inventory deductions on feed-out.",
    icon: PackageIcon,
    shipped: false,
    group: "feeding",
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
    slug: "environmental",
    label: "Environmental",
    description: "Temperature, humidity, THI. Per-barn or per-location.",
    icon: ThermometerIcon,
    shipped: false,
    group: "infrastructure",
  },

  {
    slug: "suppliers",
    label: "Suppliers",
    description: "Feed, semen, vet, equipment vendors.",
    icon: TruckIcon,
    shipped: false,
    group: "purchasing",
  },
  {
    slug: "buyers",
    label: "Buyers",
    description: "Milk processors, cull / heifer / calf buyers, manure offtake.",
    icon: ContactBookIcon,
    shipped: false,
    group: "purchasing",
  },
  {
    slug: "directories",
    label: "Directories",
    description: "Technicians, veterinarians, hoof trimmers.",
    icon: ContactBookIcon,
    shipped: true,
    group: "purchasing",
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
    description: "Milking shifts, holiday calendar.",
    icon: Calendar03Icon,
    shipped: false,
    group: "operations",
    livestockOnly: true,
  },
  {
    slug: "lab-tests",
    label: "Lab tests",
    description:
      "Milk, feed, soil, water lab result archive. Linked to events and reports.",
    icon: TestTubeIcon,
    shipped: false,
    group: "operations",
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
    description: "Parlor, robot, activity-monitor, lab and tag-reader links.",
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
    slug: "alerts",
    label: "Alerts",
    description: "Standing alerts the dashboard surfaces.",
    icon: AlertCircleIcon,
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
  /** Include placeholder / unshipped tabs (greyed-out). Default: false. */
  includeUnshipped?: boolean;
}): LocationSection[] {
  return LocationSections.filter((s) => {
    if (s.livestockOnly && !opts.manages_livestock) return false;
    if (s.cropsOnly && !opts.manages_crops) return false;
    if (!opts.includeUnshipped && !s.shipped) return false;
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
