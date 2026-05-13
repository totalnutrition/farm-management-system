import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  getOrganizationIdFromUser,
  getRoleFromUser,
  requireAnyRole,
} from "@/lib/supabase-auth";
import { RoleSuperAdmin } from "@/lib/misc";
import {
  GroupClassView,
  describePredicates,
  suggestStrategySlug,
} from "@/lib/herd-profile";
import { loadStrategyPresetCards } from "@/lib/group-strategy-presets";
import { ComingSoon } from "@/components/coming-soon";
import { getGroups, getHerdProfile } from "../../groups-actions";
import { HerdProfileForm } from "../../herd-profile-form";
import { GroupStrategyPicker } from "../../group-strategy-picker";

export const metadata = { title: "Location · Groups & rules" };
export const dynamic = "force-dynamic";

export default async function LocationGroupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAnyRole(["super_admin", "admin"]);
  const role = getRoleFromUser(user);
  const orgId = getOrganizationIdFromUser(user);

  const admin = createAdminClient();
  const { data } = await admin
    .from("locations")
    .select("id, organization_id, manages_livestock")
    .eq("id", id)
    .single();
  if (!data) notFound();
  if (role !== RoleSuperAdmin && data.organization_id !== orgId) notFound();

  if (!data.manages_livestock) {
    return (
      <ComingSoon
        title="Groups & rules"
        description="Groups apply to locations that manage livestock."
        note="Enable the Livestock module from Locations → Edit."
      />
    );
  }

  const [profile, groups, presets] = await Promise.all([
    getHerdProfile(id),
    getGroups(id),
    loadStrategyPresetCards(orgId),
  ]);

  const suggestedSlug = suggestStrategySlug(profile.target_lactating_count);
  const currentSlug =
    groups.find((g) => g.preset_slug)?.preset_slug ?? null;

  return (
    <div className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Groups &amp; rules</h1>
        <p className="text-xs text-muted-foreground">
          Logical cohorts that drive ration assignment and milking order.
          The capacity plan (PR-C.2) derives stalls and bunk-feet from
          these groups.
        </p>
      </header>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Herd profile</h2>
        <HerdProfileForm
          locationId={id}
          initial={profile}
          mode="standalone"
        />
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <header className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Active strategy</h2>
          <p className="text-xs text-muted-foreground">
            Current preset:{" "}
            <span className="font-medium">{currentSlug ?? "(none — pick one below)"}</span>
            . Suggested for your herd size:{" "}
            <span className="font-medium">{suggestedSlug}</span>.
          </p>
        </header>
        <GroupStrategyPicker
          locationId={id}
          presets={presets}
          suggestedSlug={suggestedSlug}
          currentSlug={currentSlug}
          mode="standalone"
        />
      </section>

      <section className="ring-1 ring-foreground/10 p-4 flex flex-col gap-3">
        <h2 className="text-sm font-medium">Current groups</h2>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No groups yet. Pick a strategy above to seed them.
          </p>
        ) : (
          <div className="ring-1 ring-foreground/10">
            <table className="w-full text-xs">
              <thead className="bg-foreground/5">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-foreground/10">
                    <td className="px-3 py-2 font-medium">{g.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {GroupClassView[g.group_class] ?? g.group_class}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {describePredicates(g.rule_predicates)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          Inline rule editing and the capacity plan land in PR-C.2.
        </p>
      </section>
    </div>
  );
}
