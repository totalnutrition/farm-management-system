export const PathHome = "/";
export const PathLogin = "/login";
export const PathAdminUsers = "/admin/users";
export const PathAdminOrganizations = "/admin/organizations";
export const PathQuery = "/query";
export const PathRecords = "/records";
export const PathViews = "/views";
export const PathMonitor = "/monitor";
export const PathProtocols = "/protocols";
export const PathFeed = "/feed";
export const PathSettings = "/settings";
export const PathAudit = "/audit";
export const PathSharing = "/admin/sharing";
export const PathExtended = "/extended";
export const PathImport = "/import";
export const PathHealth = "/health";
export const PathHousing = "/housing";
export const PathSires = "/sires";
export const PathActivity = "/activity";
export const PathNotifications = "/notifications";
export const PathProjection = "/projection";
export const PathSupply = "/supply";

export const RoleSuperAdmin = "super_admin";
export const RoleAdmin = "admin";
export const RoleHerdsman = "herdsman";
export const RoleVet = "vet";
export const RoleNutritionist = "nutritionist";
export const RoleFeeder = "feeder";
export const RoleViewer = "viewer";

export const RoleView: Record<string, string> = {
  [RoleSuperAdmin]: "Super Admin",
  [RoleAdmin]: "Admin",
  [RoleHerdsman]: "Herdsman",
  [RoleVet]: "Veterinarian",
  [RoleNutritionist]: "Nutritionist",
  [RoleFeeder]: "Feeder",
  [RoleViewer]: "Viewer",
};

// Visibility groups (sidebar / page gating). Write-capability per
// action is tuned incrementally; these govern who can SEE a section.
export const RolesAll = [
  RoleSuperAdmin,
  RoleAdmin,
  RoleHerdsman,
  RoleVet,
  RoleNutritionist,
  RoleFeeder,
  RoleViewer,
];
export const RolesAdmin = [RoleSuperAdmin, RoleAdmin];
