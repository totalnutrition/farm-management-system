import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import { loadPlaybook } from "@/lib/playbook";
import { PlaybookClient, type ProtocolOption } from "./playbook-client";

export const metadata = { title: "Operations playbook" };
export const dynamic = "force-dynamic";

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: locationId } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();

  const { data: location } = await admin
    .from("locations")
    .select(
      "id, name, organization_id, manages_livestock",
    )
    .eq("id", locationId)
    .maybeSingle();
  if (!location) notFound();
  if (
    role !== RoleSuperAdmin &&
    location.organization_id !== orgId
  ) {
    notFound();
  }

  const orgIdOrAny =
    role === RoleSuperAdmin || !orgId
      ? "00000000-0000-0000-0000-000000000000"
      : orgId;

  // Load the playbook + the menus of selectable protocols.
  const [
    playbook,
    { data: reproOpts },
    { data: vaxOpts },
    { data: txOpts },
    { data: hoofOpts },
    { data: dewormOpts },
    { data: dryOpts },
    { data: groupRows },
    { data: dairyRow },
    { data: recordingRow },
  ] = await Promise.all([
    loadPlaybook(locationId),
    admin
      .from("org_repro_protocols")
      .select("id, name, protocol_type")
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order("name"),
    admin
      .from("org_vaccination_protocols")
      .select("id, name, target_class")
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order("name"),
    admin
      .from("org_treatment_protocols")
      .select("id, name, diagnosis_code")
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order("name"),
    admin
      .from("org_hoof_trim_protocols")
      .select("id, name, target_class")
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order("name"),
    admin
      .from("org_deworming_protocols")
      .select("id, name, target_class")
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order("name"),
    admin
      .from("org_dry_off_protocols")
      .select("id, name, approach_days")
      .or(`organization_id.is.null,organization_id.eq.${orgIdOrAny}`)
      .order("name"),
    admin
      .from("location_groups")
      .select("id, label, group_class, display_order")
      .eq("location_id", locationId)
      .order("display_order"),
    admin
      .from("location_dairy_settings")
      .select(
        "voluntary_waiting_period_days, preg_check_initial_days, preg_check_confirm_days, expected_gestation_days",
      )
      .eq("location_id", locationId)
      .maybeSingle(),
    admin
      .from("recording_profiles")
      .select("milkings_per_day, recording_method")
      .eq("location_id", locationId)
      .maybeSingle(),
  ]);

  const toOptions = (
    rows: Array<Record<string, unknown>> | null,
    secondary?: string,
  ): ProtocolOption[] =>
    (rows ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      detail: secondary ? ((r[secondary] as string | null) ?? null) : null,
    }));

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">
          Operations playbook
        </h1>
        <p className="text-xs text-muted-foreground">
          {location.name as string} · every operational decision for this
          farm in one place. Strategies, active protocols, KPI thresholds,
          and schedules. Pulls from the org library — overrides land per
          location. The Hot list and the rule engines read from here.
        </p>
        <p className="text-[10px] text-muted-foreground">
          See also:{" "}
          <Link
            href={`/settings/locations/${locationId}/groups`}
            className="underline underline-offset-2"
          >
            Herd structure
          </Link>{" "}
          ·{" "}
          <Link
            href={`/settings/locations/${locationId}/reproduction`}
            className="underline underline-offset-2"
          >
            Reproduction settings
          </Link>{" "}
          ·{" "}
          <Link
            href="/settings/organization/protocols"
            className="underline underline-offset-2"
          >
            Org protocol library
          </Link>
          .
        </p>
      </header>

      <PlaybookClient
        locationId={locationId}
        playbook={playbook}
        reproOptions={toOptions(reproOpts as Record<string, unknown>[] | null, "protocol_type")}
        vaccinationOptions={toOptions(vaxOpts as Record<string, unknown>[] | null, "target_class")}
        treatmentOptions={toOptions(txOpts as Record<string, unknown>[] | null, "diagnosis_code")}
        hoofTrimOptions={toOptions(hoofOpts as Record<string, unknown>[] | null, "target_class")}
        dewormingOptions={toOptions(dewormOpts as Record<string, unknown>[] | null, "target_class")}
        dryOffOptions={toOptions(dryOpts as Record<string, unknown>[] | null, "approach_days")}
        groups={
          (groupRows ?? []).map((g) => ({
            id: g.id as string,
            label: g.label as string,
            group_class: g.group_class as string,
          })) as Array<{ id: string; label: string; group_class: string }>
        }
        reproductionSettings={
          dairyRow
            ? {
                vwp_days:
                  (dairyRow.voluntary_waiting_period_days as number | null) ??
                  null,
                preg_check_initial_days:
                  (dairyRow.preg_check_initial_days as number | null) ?? null,
                preg_check_confirm_days:
                  (dairyRow.preg_check_confirm_days as number | null) ?? null,
                expected_gestation_days:
                  (dairyRow.expected_gestation_days as number | null) ?? null,
              }
            : null
        }
        recordingProfile={
          recordingRow
            ? {
                milkings_per_day:
                  (recordingRow.milkings_per_day as number | null) ?? null,
                recording_method:
                  (recordingRow.recording_method as string | null) ?? null,
              }
            : null
        }
      />
    </div>
  );
}
