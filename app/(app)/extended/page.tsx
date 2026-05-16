import { requireUser } from "@/lib/supabase-auth";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Extended Services" };
export const dynamic = "force-dynamic";

const SERVICES = [
  {
    name: "Lab / Feed Testing",
    desc: "Submit and track forage & milk samples; results auto-import into the herd record.",
  },
  {
    name: "External Consultancy",
    desc: "Scoped access for your vet & nutritionist with remote review and recommendations.",
  },
  {
    name: "On-Farm Visits",
    desc: "Schedule and log vet/consultant visits, findings, and action items.",
  },
  {
    name: "AI System",
    desc: "Assistant and insights over your herd data — anomaly flags and recommendations.",
  },
];

export default async function ExtendedPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">
          Insight Extended Services
        </h1>
        <p className="text-xs text-muted-foreground">
          Coming soon — additional services that build on your herd data.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <Card key={s.name} className="opacity-70">
            <CardContent className="space-y-1 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
