export const PathHome = "/";
export const PathLogin = "/login";
export const PathWork = "/";
export const PathCows = "/cows";
export const PathAnalyze = "/analyze";
export const PathSetup = "/setup";
export const PathAdminUsers = "/admin/users";
export const PathAdminOrganizations = "/admin/organizations";

export const cowPath = (tag: string) => `/cow/${encodeURIComponent(tag)}`;
export const listPath = (key: string) => `/list/${encodeURIComponent(key)}`;

export const RoleSuperAdmin = "super_admin";
export const RoleAdmin = "admin";

export const RoleView: Record<string, string> = {
  [RoleSuperAdmin]: "Super Admin",
  [RoleAdmin]: "Admin",
};
