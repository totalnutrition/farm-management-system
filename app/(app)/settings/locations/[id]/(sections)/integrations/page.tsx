import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Integrations" };

export default function LocationIntegrationsPage() {
  return (
    <ComingSoon
      title="Integrations"
      description="API keys for Lely, DeLaval, GEA, Afimilk and other vendor systems. Webhook URLs and import history."
      note="API integrations land in PR-K. Import history wires up in PR-F.2."
    />
  );
}
