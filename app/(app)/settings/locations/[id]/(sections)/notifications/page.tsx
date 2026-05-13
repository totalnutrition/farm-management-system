import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Notifications" };

export default function LocationNotificationsPage() {
  return (
    <ComingSoon
      title="Notifications"
      description="Event-trigger rules per location. Per-user channels live in account settings."
      note="Lands in PR-Q."
    />
  );
}
