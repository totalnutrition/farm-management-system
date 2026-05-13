import {
  Location01Icon,
  Settings01Icon,
  ClipboardClockIcon,
  BarnsIcon,
  GroupLayersIcon,
  DollarCircleIcon,
  PolyTankIcon,
  ApiIcon,
  Notification02Icon,
  ContactBookIcon,
  Notebook01Icon,
  ShieldUserIcon,
  WheatIcon,
  DownloadCircle01Icon,
} from "@hugeicons/core-free-icons";
import { CowFaceIcon } from "@/lib/custom-icons";

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
  | "dairy"
  | "crops"
  | "infrastructure"
  | "access"
  | "system";

export const LocationSectionGroupLabels: Record<LocationSectionGroup, string | null> = {
  overview: null,
  setup: "Setup",
  dairy: "Animals & dairy",
  crops: "Crops",
  infrastructure: "Infrastructure",
  access: "People & access",
  system: "System",
};

export const LocationSectionGroupOrder: LocationSectionGroup[] = [
  "overview",
  "setup",
  "dairy",
  "crops",
  "infrastructure",
  "access",
  "system",
];

/**
 * Subnav catalog for /settings/locations/[id]/*.
 *
 * Sections are bucketed into groups so the subnav reads logically:
 *   Overview → Setup → Animals & dairy → Crops → Infrastructure
 *   → People & access → System
 *
 * `shipped` controls whether the entry links into a real page or shows
 * "coming soon" in the destination. Filtering by `livestockOnly` /
 * `cropsOnly` happens in `relevantLocationSections`.
 */
export const LocationSections: LocationSection[] = [
  // Overview
  {
    slug: "",
    label: "Overview",
    description: "Status snapshot for this location.",
    icon: Location01Icon,
    shipped: true,
    group: "overview",
  },

  // Setup
  {
    slug: "general",
    label: "General",
    description: "Identity, modules, areas, timezone, overrides.",
    icon: Settings01Icon,
    shipped: true,
    group: "setup",
  },
  {
    slug: "recording",
    label: "Recording profile",
    description: "Test-day frequency, milkings/day, recording method.",
    icon: ClipboardClockIcon,
    shipped: true,
    group: "setup",
    livestockOnly: true,
  },

  // Animals & dairy
  {
    slug: "animals",
    label: "Animals",
    description: "Roster of animals at this location.",
    icon: CowFaceIcon,
    shipped: true,
    group: "dairy",
    livestockOnly: true,
  },
  {
    slug: "groups",
    label: "Groups & rules",
    description: "Animal groups, rules, capacity plan.",
    icon: GroupLayersIcon,
    shipped: true,
    group: "dairy",
    livestockOnly: true,
  },
  {
    slug: "bulk-tank",
    label: "Bulk milk chiller",
    description: "Tank readings, diversions, reconciliation.",
    icon: PolyTankIcon,
    shipped: true,
    group: "dairy",
    livestockOnly: true,
  },
  {
    slug: "milk-pricing",
    label: "Milk pricing",
    description: "Pricing schemes with effective dates.",
    icon: DollarCircleIcon,
    shipped: true,
    group: "dairy",
    livestockOnly: true,
  },

  // Crops
  {
    slug: "crops",
    label: "Forage & crops",
    description: "Forage / fodder plans on arable parcels.",
    icon: WheatIcon,
    shipped: true,
    group: "crops",
    cropsOnly: true,
  },

  // Infrastructure
  {
    slug: "infrastructure",
    label: "Infrastructure",
    description: "Barns, pens, arable parcels.",
    icon: BarnsIcon,
    shipped: true,
    group: "infrastructure",
  },

  // People & access
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

  // System
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
