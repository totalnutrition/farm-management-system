import {
  Building03Icon,
  ShieldUserIcon,
  BookOpen01Icon,
  Layout01Icon,
  CreditCardIcon,
  Note04Icon,
  SpermIcon,
  ClipboardClockIcon,
} from "@hugeicons/core-free-icons";
import { PathSettingsOrganization } from "./misc";

type HugeIcon = typeof Building03Icon;

export type OrganizationSection = {
  slug: string;
  label: string;
  description: string;
  href: string;
  icon: HugeIcon;
  shipped: boolean;
};

export const OrganizationSections: OrganizationSection[] = [
  {
    slug: "general",
    label: "General",
    description: "Identity, defaults, and contact details.",
    href: `${PathSettingsOrganization}/general`,
    icon: Building03Icon,
    shipped: true,
  },
  {
    slug: "security",
    label: "Security",
    description: "Password policy, SSO, MFA, sessions, IP allowlist.",
    href: `${PathSettingsOrganization}/security`,
    icon: ShieldUserIcon,
    shipped: false,
  },
  {
    slug: "catalogs",
    label: "Catalogs",
    description: "Breeds, diagnoses, drugs, cull reasons, protocols.",
    href: `${PathSettingsOrganization}/catalogs`,
    icon: BookOpen01Icon,
    shipped: false,
  },
  {
    slug: "sires",
    label: "Sires",
    description: "AI bull catalog — NAAB, breed, transmitted traits.",
    href: `${PathSettingsOrganization}/sires`,
    icon: SpermIcon,
    shipped: true,
  },
  {
    slug: "protocols",
    label: "Protocols",
    description:
      "Repro, vaccination, treatment, hoof-trim, deworming, dry-off SOPs.",
    href: `${PathSettingsOrganization}/protocols`,
    icon: ClipboardClockIcon,
    shipped: true,
  },
  {
    slug: "presets",
    label: "Presets",
    description:
      "Group strategies, pricing schemes, capacity defaults.",
    href: `${PathSettingsOrganization}/presets`,
    icon: Layout01Icon,
    shipped: true,
  },
  {
    slug: "billing",
    label: "Billing",
    description: "Plan, seats, payment, invoices.",
    href: `${PathSettingsOrganization}/billing`,
    icon: CreditCardIcon,
    shipped: false,
  },
  {
    slug: "audit",
    label: "Audit log",
    description: "Tenant-wide audit history.",
    href: `${PathSettingsOrganization}/audit`,
    icon: Note04Icon,
    shipped: false,
  },
];
