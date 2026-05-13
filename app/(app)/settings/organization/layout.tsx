import { SectionSubnav } from "@/components/section-subnav";
import { OrganizationSections } from "@/lib/organization-sections";

export const dynamic = "force-dynamic";

export default function OrganizationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const items = OrganizationSections.map((s) => ({
    href: s.href,
    label: s.label,
    description: s.description,
    icon: s.icon,
    shipped: s.shipped,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-2">
        <div className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Organization
        </div>
        <SectionSubnav items={items} ariaLabel="Organization settings" />
      </aside>
      <main className="flex flex-col gap-4">{children}</main>
    </div>
  );
}
