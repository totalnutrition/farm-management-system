import {
  Location01Icon,
  Settings01Icon,
  Mic01Icon,
  Building03Icon,
  UserGroupIcon,
  DollarCircleIcon,
  MilkBottleIcon,
  PlugSocketIcon,
  Notification02Icon,
  UserListIcon,
  BookOpen01Icon,
  LockKeyIcon,
} from "@hugeicons/core-free-icons";

type HugeIcon = typeof Location01Icon;

export type LocationSection = {
  slug: "" | string;
  label: string;
  description: string;
  icon: HugeIcon;
  shipped: boolean;
  livestockOnly?: boolean;
  cropsOnly?: boolean;
};

/**
 * Subnav catalog for /settings/locations/[id]/*.
 *
 * The empty slug ("") corresponds to the bare /settings/locations/[id]
 * overview route. All other slugs are appended to that path.
 *
 * `shipped` controls whether the entry links into a real page or shows
 * "coming soon" in the destination. The subnav still lists every section
 * so the eventual IA is visible during the build-out.
 */
export const LocationSections: LocationSection[] = [
  {
    slug: "",
    label: "Overview",
    description: "Status snapshot for this location.",
    icon: Location01Icon,
    shipped: true,
  },
  {
    slug: "general",
    label: "General",
    description: "Identity, modules, areas, timezone, overrides.",
    icon: Settings01Icon,
    shipped: true,
  },
  {
    slug: "recording",
    label: "Recording profile",
    description: "Test-day frequency, milkings/day, recording method.",
    icon: Mic01Icon,
    shipped: true,
    livestockOnly: true,
  },
  {
    slug: "infrastructure",
    label: "Infrastructure",
    description: "Land parcels, barns, pens.",
    icon: Building03Icon,
    shipped: false,
  },
  {
    slug: "groups",
    label: "Groups & rules",
    description: "Group strategy, rules, capacity plan.",
    icon: UserGroupIcon,
    shipped: true,
    livestockOnly: true,
  },
  {
    slug: "milk-pricing",
    label: "Milk pricing",
    description: "Pricing schemes with effective dates.",
    icon: DollarCircleIcon,
    shipped: false,
    livestockOnly: true,
  },
  {
    slug: "bulk-tank",
    label: "Bulk tank",
    description: "Reconciliation threshold and diversion buckets.",
    icon: MilkBottleIcon,
    shipped: false,
    livestockOnly: true,
  },
  {
    slug: "integrations",
    label: "Integrations",
    description: "API keys, webhooks, import history.",
    icon: PlugSocketIcon,
    shipped: false,
  },
  {
    slug: "notifications",
    label: "Notifications",
    description: "Event-trigger rules for this location.",
    icon: Notification02Icon,
    shipped: false,
  },
  {
    slug: "directories",
    label: "Directories",
    description: "Technicians, veterinarians, hoof trimmers.",
    icon: UserListIcon,
    shipped: false,
  },
  {
    slug: "custom-vocabularies",
    label: "Custom vocabularies",
    description: "Local additions to organization catalogs.",
    icon: BookOpen01Icon,
    shipped: false,
  },
  {
    slug: "access",
    label: "Access",
    description: "Users who can access this location + permissions.",
    icon: LockKeyIcon,
    shipped: false,
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
