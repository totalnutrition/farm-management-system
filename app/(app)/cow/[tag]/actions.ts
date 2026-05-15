"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole } from "@/lib/supabase-auth";
import { EVENT_TYPES } from "@/lib/herd";
import { cowPath, PathWork } from "@/lib/misc";

type Result = { error?: string; success?: boolean };

const schema = z.object({
  tag: z.string().trim().min(1),
  event_type: z.enum(EVENT_TYPES),
  event_date: z.string().trim().min(1, "Date is required."),
  note: z.string().trim().optional(),
  // free-form per-event fields (pen, result, drug, ...) kept terse (#9)
  data: z.record(z.string(), z.string()).optional(),
});

// Append-only (#10). A mistake is fixed by adding another event, never by
// editing or deleting one — the DB has no update/delete path for events.
export async function addEvent(
  input: z.infer<typeof schema>,
): Promise<Result> {
  await requireAnyRole(["super_admin", "admin"]);

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tag, event_type, event_date, note, data } = parsed.data;

  const admin = createAdminClient();
  const { data: animal, error: findErr } = await admin
    .from("animals")
    .select("id, organization_id")
    .eq("tag", tag)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!animal) return { error: `No animal with tag ${tag}.` };

  const { error } = await admin.from("animal_events").insert({
    organization_id: animal.organization_id,
    animal_id: animal.id,
    event_type,
    event_date,
    note: note || null,
    data: data ?? {},
  });
  if (error) return { error: error.message };

  revalidatePath(cowPath(tag));
  revalidatePath(PathWork);
  return { success: true };
}
