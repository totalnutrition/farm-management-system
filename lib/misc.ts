export const PathHome = "/";
export const PathLogin = "/login";
export const PathAdminUsers = "/admin/users";
export const PathAdminOrganizations = "/admin/organizations";
export const PathQuery = "/query";
export const PathRecords = "/records";
export const PathViews = "/views";
export const PathGrouping = "/grouping";
export const PathPens = "/pens";
export const PathMonitor = "/monitor";
export const PathProtocols = "/protocols";
export const PathFeed = "/feed";
export const PathSettings = "/settings";
export const PathAudit = "/audit";

export const RoleSuperAdmin = "super_admin";
export const RoleAdmin = "admin";

export const RoleView: Record<string, string> = {
  [RoleSuperAdmin]: "Super Admin",
  [RoleAdmin]: "Admin",
};
