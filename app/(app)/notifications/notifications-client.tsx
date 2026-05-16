"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runNotificationSweep, markRead, markAllRead } from "./actions";

export type NotifRow = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
};

const SEV: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  alert: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function NotificationsClient({ rows }: { rows: NotifRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = rows.filter((r) => !r.read).length;

  const act = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.error) return void toast.error(res.error);
      if (ok) toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => act(runNotificationSweep, "Swept.")}
        >
          {pending ? "Working…" : "Refresh now"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || unread === 0}
          onClick={() => act(markAllRead, "All marked read.")}
        >
          Mark all read ({unread})
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Click “Refresh now” to sweep current alerts.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card
              key={r.id}
              className={r.read ? "opacity-60" : ""}
            >
              <CardContent className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] uppercase " +
                        (SEV[r.severity] ?? "bg-muted")
                      }
                    >
                      {r.severity}
                    </span>
                    <Link
                      href={r.link}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {r.title}
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.body}</p>
                </div>
                {!r.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      act(() => markRead(r.id), "")
                    }
                  >
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
