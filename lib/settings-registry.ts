import {
  Building03Icon,
  Location01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

type HugeIcon = typeof Building03Icon;
import {
  PathSettingsAccount,
  PathSettingsLocations,
  PathSettingsOrganization,
  PathSettingsUsers,
  RoleAdmin,
  RoleSuperAdmin,
} from "./misc";

export type SettingsItem = {
  slug: string;
  label: string;
  href: string;
  description?: string;
  icon?: HugeIcon;
  roles: readonly string[];
};

export type SettingsGroup = {
  key: string;
  label: string;
  items: SettingsItem[];
};

/**
 * Single source of truth for the Settings area. New modules append their
 * own groups here; the sidebar Settings sub-nav, breadcrumbs, and (later)
 * the per-user permission matrix all read from this list.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: "account",
    label: "Account",
    items: [
      {
        slug: "profile",
        label: "My Account",
        href: PathSettingsAccount,
        description: "Your profile, password, and sign-in.",
        icon: UserCircleIcon,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
    ],
  },
  {
    key: "organization",
    label: "Organization",
    items: [
      {
        slug: "organization",
        label: "Organization",
        href: PathSettingsOrganization,
        description: "Name, address, and contact details.",
        icon: Building03Icon,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
      {
        slug: "locations",
        label: "Locations",
        href: PathSettingsLocations,
        description: "Farms and sites under this organization.",
        icon: Location01Icon,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
      {
        slug: "users",
        label: "Users",
        href: PathSettingsUsers,
        description: "People who can sign in to this organization.",
        icon: UserGroupIcon,
        roles: [RoleSuperAdmin, RoleAdmin],
      },
    ],
  },
];

export function settingsItemsForRole(role: string | null): SettingsGroup[] {
  if (!role) return [];
  return SETTINGS_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export function firstSettingsHrefForRole(role: string | null): string {
  const groups = settingsItemsForRole(role);
  return groups[0]?.items[0]?.href ?? PathSettingsAccount;
}
