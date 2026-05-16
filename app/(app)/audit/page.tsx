import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";

export const metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  enter: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  alter: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export default async function AuditPage() {
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId)
    return (
      <p className="p-4 text-xs text-destructive">
        Your account is not linked to an organization.
      </p>
    );

  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_log")
    .select(
      "occurred_at, category, table_name, description, source, event_date",
    )
    .eq("organization_id", orgId)
    .order("occurred_at", { ascending: false })
    .limit(300);

  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Audit Log</h1>
        <p className="text-xs text-muted-foreground">
          Every ledger entry and config change, captured at the
          database — unbypassable. Last {rows.length}.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Where</th>
                <th className="px-3 py-2 text-left">What</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">
                    {new Date(r.occurred_at as string).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[10px] uppercase " +
                        (BADGE[r.category as string] ?? "bg-muted")
                      }
                    >
                      {r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.table_name}
                  </td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
