import { requireUser } from "@/lib/supabase-auth";
import { RoleView } from "@/lib/misc";

export const metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const role = (user.app_metadata?.role as string | undefined) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-medium">My Account</h2>
        <p className="text-xs text-muted-foreground">
          Your profile, password, and sign-in details.
        </p>
      </header>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" value={fullName ?? "—"} />
        <Field label="Email" value={user.email ?? "—"} />
        <Field label="Role" value={role ? (RoleView[role] ?? role) : "—"} />
      </dl>
      <p className="text-xs text-muted-foreground">
        Password change and notification preferences coming soon.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md ring-1 ring-foreground/10 p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
