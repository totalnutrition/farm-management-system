import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAnyRole, getOrganizationIdFromUser } from "@/lib/supabase-auth";
import { derive, type Event } from "@/lib/derive/engine";
import { RecordDetail } from "./record-detail";

export const metadata = { title: "Animal record" };
export const dynamic = "force-dynamic";

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const orgId = getOrganizationIdFromUser(user);
  if (!orgId) notFound();

  const admin = createAdminClient();
  const { data: subject } = await admin
    .from("subjects")
    .select("id, natural_key, name, attrs")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!subject) notFound();

  const { data: rawEvents } = await admin
    .from("events")
    .select("event_code, event_date, remark, recorded_at")
    .eq("organization_id", orgId)
    .eq("subject_id", id)
    .order("event_date", { ascending: false });

  const { data: codes } = await admin
    .from("event_codes")
    .select("code, name, label")
    .eq("organization_id", orgId)
    .order("code");

  const codeName = new Map(
    (codes ?? []).map((c) => [c.code, c.label || c.name]),
  );

  const a = (subject.attrs ?? {}) as Record<string, unknown>;
  const events: Event[] = (rawEvents ?? []).map((e) => ({
    code: e.event_code,
    date: e.event_date,
  }));
  const today = new Date().toISOString().slice(0, 10);
  const state = derive(
    {
      events,
      facts: {
        birthDate:
          typeof a.birth_date === "string" ? a.birth_date : undefined,
        baseLactation:
          typeof a.base_lactation === "number" ? a.base_lactation : undefined,
      },
    },
    { today },
  );

  const timeline = (rawEvents ?? []).map((e) => ({
    date: e.event_date,
    label: codeName.get(e.event_code) ?? `EC ${e.event_code}`,
    remark: e.remark as string | null,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl py-6">
      <Link
        href="/records"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        ← All records
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
        {subject.natural_key}
        {subject.name ? (
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {subject.name}
          </span>
        ) : null}
      </h1>

      <RecordDetail
        subjectId={subject.id}
        state={state}
        timeline={timeline}
        codes={(codes ?? []).map((c) => ({
          code: c.code,
          label: c.label || c.name,
        }))}
      />
    </div>
  );
}
