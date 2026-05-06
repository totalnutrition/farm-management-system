export type LocationKind =
  | "dairy"
  | "beef"
  | "poultry"
  | "small_ruminants"
  | "mixed"
  | "other";

export const LocationKindDairy: LocationKind = "dairy";
export const LocationKindBeef: LocationKind = "beef";
export const LocationKindPoultry: LocationKind = "poultry";
export const LocationKindSmallRuminants: LocationKind = "small_ruminants";
export const LocationKindMixed: LocationKind = "mixed";
export const LocationKindOther: LocationKind = "other";

export const LocationKindView: Record<LocationKind, string> = {
  dairy: "Dairy",
  beef: "Beef / Fattening",
  poultry: "Poultry",
  small_ruminants: "Small Ruminants",
  mixed: "Mixed",
  other: "Other",
};

export const LocationKindEnabled: Record<LocationKind, boolean> = {
  dairy: true,
  beef: false,
  poultry: false,
  small_ruminants: false,
  mixed: true,
  other: false,
};

export const LocationKindOrder: LocationKind[] = [
  "dairy",
  "mixed",
  "beef",
  "poultry",
  "small_ruminants",
  "other",
];
