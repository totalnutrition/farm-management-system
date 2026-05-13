import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Access" };

export default function LocationAccessPage() {
  return (
    <ComingSoon
      title="Access"
      description="Users who can access this location and their per-section permissions."
      note="Lands in PR-O. Replaces the flat location_members table from PR #10."
    />
  );
}
