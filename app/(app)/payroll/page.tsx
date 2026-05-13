import { OperationalPlaceholder } from "@/components/operational-placeholder";

export const metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <OperationalPlaceholder
      title="Payroll"
      description="Periodic wage runs derived from attendance, contract rate, advances, and deductions. Generates payslips and a payable line per worker."
      livestockOnly={false}
    />
  );
}
