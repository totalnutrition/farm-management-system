import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase-admin";
import { PathNotifications } from "@/lib/misc";

// Top-right bell. Replaces the sidebar "Notifications" entry: shows
// the unread count and links to the full list. The count query is
// best-effort — a missing org or table never breaks the chrome.
export async function NotificationBell({
  orgId,
}: {
  orgId: string | null;
}) {
  let unread = 0;
  if (orgId) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("read_at", null);
    unread = count ?? 0;
  }
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href={PathNotifications} aria-label="Notifications">
        <HugeiconsIcon icon={Notification01Icon} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
