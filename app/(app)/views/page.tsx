import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { serializeCommand, type Query } from "@/lib/derive/query";
import { ViewsTable, type ViewRow } from "./views-table";

export const metadata = { title: "Views" };
export const dynamic = "force-dynamic";

export default async function ViewsPage() {
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
    .from("views")
    .select("id, name, description, query")
    .eq("organization_id", orgId)
    .order("name");

  const rows: ViewRow[] = (data ?? []).map((v) => {
    const q = v.query as Query;
    let command = "";
    try {
      command = serializeCommand(q);
    } catch {
      command = "(unparseable query)";
    }
    return {
      id: v.id,
      name: v.name,
      description: v.description as string | null,
      command,
      query: q,
    };
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Views</h1>
        <p className="text-xs text-muted-foreground">
          Saved questions. Save one from the Query screen, run it here
          anytime.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved views yet. Build a query on the Query screen and click
          “Save as view”.
        </p>
      ) : (
        <ViewsTable rows={rows} />
      )}
    </div>
  );
}
