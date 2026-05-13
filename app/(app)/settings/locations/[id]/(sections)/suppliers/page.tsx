import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Suppliers" };

export default function Page() {
  return (
    <ComingSoon
      title="Suppliers"
      description="Feed, semen, veterinary, equipment, and forage suppliers. Used as the FK target for purchasing events and inventory deductions."
    />
  );
}
