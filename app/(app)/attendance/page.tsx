import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Attendance"
      description="Daily clock-in / clock-out per worker, with shift and role. Feeds payroll and links operational events to the operator who logged them."
      livestockOnly={false}
    />
  );
}
