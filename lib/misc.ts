export const PathHome = "/";
export const PathLogin = "/login";

export const PathSettings = "/settings";
export const PathSettingsAccount = "/settings/account";
export const PathSettingsUsers = "/settings/users";
export const PathSettingsOrganization = "/settings/organization";
export const PathSettingsLocations = "/settings/locations";

export const RoleSuperAdmin = "super_admin";
export const RoleAdmin = "admin";

export const RoleView: Record<string, string> = {
  [RoleSuperAdmin]: "Super Admin",
  [RoleAdmin]: "Admin",
};

export const FarmTypeDairy = "dairy";
export const FarmTypeSheepGoat = "sheep_goat";
export const FarmTypePoultry = "poultry";
export const FarmTypeOther = "other";

export type FarmType =
  | typeof FarmTypeDairy
  | typeof FarmTypeSheepGoat
  | typeof FarmTypePoultry
  | typeof FarmTypeOther;

export const FarmTypes: { value: FarmType; label: string; enabled: boolean }[] = [
  { value: FarmTypeDairy, label: "Dairy Farm", enabled: true },
  { value: FarmTypeSheepGoat, label: "Sheep / Goat Farm", enabled: false },
  { value: FarmTypePoultry, label: "Poultry Farm", enabled: false },
  { value: FarmTypeOther, label: "Other", enabled: false },
];

export const FarmTypeView: Record<string, string> = Object.fromEntries(
  FarmTypes.map((f) => [f.value, f.label]),
);

export const LocationStatusActive = "active";
export const LocationStatusArchived = "archived";
export type LocationStatus =
  | typeof LocationStatusActive
  | typeof LocationStatusArchived;

export const ActiveLocationCookie = "fi_location_id";
