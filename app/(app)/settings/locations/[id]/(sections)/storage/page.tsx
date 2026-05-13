import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Storage" };

export default function Page() {
  return (
    <ComingSoon
      title="Storage"
      description="Silos, bins, freezers, and other physical storage. Inventory levels are deducted automatically when feed-out events happen."
    />
  );
}
