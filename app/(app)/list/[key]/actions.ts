"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { EVENT_TYPES } from "@/lib/herd";
import { listPath, PathWork } from "@/lib/misc";

type Result = { error?: string; success?: boolean; count?: number };

const schema = z.object({
  listKey: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).min(1, "Select at least one cow."),
  event_type: z.enum(EVENT_TYPES),
  event_date: z.string().trim().min(1, "Date is required."),
  note: z.string().trim().optional(),
  data: z.record(z.string(), z.string()).optional(),
});

// Doctrine #3: the primary motion is bulk — one action across a whole
// generated list. Each cow still gets its own immutable event row (#10).
export async function bulkAddEvent(
  input: z.infer<typeof schema>,
): Promise<Result> {
  await requireAnyRole(["super_admin", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { listKey, tags, event_type, event_date, note, data } = parsed.data;

  const admin = createAdminClient();
  const { data: animals, error: findErr } = await admin
    .from("animals")
    .select("id, organization_id, tag")
    .in("tag", tags);
  if (findErr) return { error: findErr.message };
  if (!animals || animals.length === 0) {
    return { error: "None of the selected cows were found." };
  }

  const rows = animals.map((a) => ({
    organization_id: a.organization_id,
    animal_id: a.id,
    event_type,
    event_date,
    note: note || null,
    data: data ?? {},
  }));

  const { error } = await admin.from("animal_events").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(listPath(listKey));
  revalidatePath(PathWork);
  return { success: true, count: rows.length };
}
