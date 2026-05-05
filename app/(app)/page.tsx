import { requireUser } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "there";

  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold">Welcome, {name}</h2>
      <h1 className="text-5xl font-bold">Insight: Farm Management System</h1>
    </div>
  );
}
