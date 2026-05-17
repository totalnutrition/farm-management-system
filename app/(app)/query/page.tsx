import { createAdminClient } from "@/lib/supabase-admin";
import {
  getCurrentUser,
  getRoleFromUser,
  getOrganizationIdFromUser,
} from "@/lib/supabase-auth";
import type { CalcFieldRow } from "@/lib/calc-fields";
import { QueryBuilder } from "./query-builder";
import { CalculatedFields } from "./calculated-fields";

export const dynamic = "force-dynamic";

export default async function QueryPage() {
  const user = await getCurrentUser();
  const orgId = user ? getOrganizationIdFromUser(user) : null;
  const role = user ? getRoleFromUser(user) : null;
  const canEdit = role === "super_admin" || role === "admin";

  let calcFields: CalcFieldRow[] = [];
  if (orgId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("calculated_fields")
      .select("id, key, label, expression, kind")
      .eq("organization_id", orgId)
      .order("label");
    calcFields = (data ?? []) as CalcFieldRow[];
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Query</h1>
        <p className="text-xs text-muted-foreground">
          Build a question in plain language. No syntax to learn.
        </p>
      </header>
      <QueryBuilder calcFields={calcFields} />
      <CalculatedFields rows={calcFields} canEdit={canEdit} />
    </div>
  );
}
