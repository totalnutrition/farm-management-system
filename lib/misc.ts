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

// ---------- Wizard steps ----------
export const SetupStepIdentity = "identity";
export const SetupStepRecording = "recording";
export const SetupStepImportChoice = "import_choice";
export const SetupStepImport = "import";
export const SetupStepHerdProfile = "herd_profile";
export const SetupStepGroupStrategy = "group_strategy";
export const SetupStepRules = "rules";
export const SetupStepCapacityPlan = "capacity_plan";
export const SetupStepBarns = "barns";
export const SetupStepPens = "pens";
export const SetupStepArableParcels = "arable_parcels";
export const SetupStepDone = "done";

export type SetupStep =
  | typeof SetupStepIdentity
  | typeof SetupStepRecording
  | typeof SetupStepImportChoice
  | typeof SetupStepImport
  | typeof SetupStepHerdProfile
  | typeof SetupStepGroupStrategy
  | typeof SetupStepRules
  | typeof SetupStepCapacityPlan
  | typeof SetupStepBarns
  | typeof SetupStepPens
  | typeof SetupStepArableParcels
  | typeof SetupStepDone;

export type WizardStep = {
  key: SetupStep;
  label: string;
  description: string;
  shipped: boolean;
  livestockOnly?: boolean;
  cropsOnly?: boolean;
};

export const WizardSteps: WizardStep[] = [
  {
    key: SetupStepIdentity,
    label: "Location identity",
    description: "Name, code, address, modules, areas.",
    shipped: true,
  },
  {
    key: SetupStepRecording,
    label: "Recording profile",
    description: "Test-day frequency, milkings per day, recording method.",
    shipped: true,
    livestockOnly: true,
  },
  {
    key: SetupStepImportChoice,
    label: "Existing records?",
    description: "Decide whether to import animals from another system.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepHerdProfile,
    label: "Herd profile",
    description: "Target counts by class.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepGroupStrategy,
    label: "Group strategy",
    description: "Pick a preset that matches your herd size.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepRules,
    label: "Rules per group",
    description: "DIM, yield, parity, repro predicates.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepCapacityPlan,
    label: "Capacity plan",
    description: "Computed stalls and bunk-feet per group.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepBarns,
    label: "Barns",
    description: "Physical barn shells.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepPens,
    label: "Pens",
    description: "Pens inside barns, assigned to groups.",
    shipped: false,
    livestockOnly: true,
  },
  {
    key: SetupStepArableParcels,
    label: "Arable parcels",
    description: "Crop fields.",
    shipped: false,
    cropsOnly: true,
  },
];

// ---------- Paths ----------
export function pathLocationDetail(id: string): string {
  return `${PathSettingsLocations}/${id}`;
}

export function pathLocationSetup(id: string): string {
  return `${PathSettingsLocations}/${id}/setup`;
}

export function pathLocationSetupStep(id: string, step: SetupStep): string {
  return `${PathSettingsLocations}/${id}/setup/${step}`;
}

/**
 * Filters WizardSteps to the ones that apply to a location given its
 * livestock/crops modules.
 */
export function relevantWizardSteps(opts: {
  manages_livestock: boolean;
  manages_crops: boolean;
}): WizardStep[] {
  return WizardSteps.filter((s) => {
    if (s.livestockOnly && !opts.manages_livestock) return false;
    if (s.cropsOnly && !opts.manages_crops) return false;
    return true;
  });
}

/**
 * Computes the step that follows `currentStep` for a location. Returns
 * `SetupStepDone` when `currentStep` is the last relevant step.
 */
export function nextWizardStep(
  opts: { manages_livestock: boolean; manages_crops: boolean },
  currentStep: SetupStep,
): SetupStep {
  const steps = relevantWizardSteps(opts);
  const idx = steps.findIndex((s) => s.key === currentStep);
  if (idx === -1 || idx === steps.length - 1) return SetupStepDone;
  return steps[idx + 1].key;
}

// ---------- Units ----------
// Internal storage: hectares (areas), kg (mass), L (volume).
// User display conversion is handled at render time.
export const HectaresToAcres = 2.4710538147;
export const AcresToHectares = 1 / HectaresToAcres;
