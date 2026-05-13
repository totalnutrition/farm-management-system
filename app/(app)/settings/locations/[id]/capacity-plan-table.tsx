import type { CapacityPlan } from "@/lib/capacity-plan";

export function CapacityPlanTable({ plan }: { plan: CapacityPlan }) {
  if (plan.rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Apply a group strategy to see the capacity plan.
      </p>
    );
  }
  return (
    <div className="ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-foreground/5">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Group</th>
            <th className="px-3 py-2 font-medium text-right">Head</th>
            <th className="px-3 py-2 font-medium text-right">Stocking</th>
            <th className="px-3 py-2 font-medium text-right">Pen cap</th>
            <th className="px-3 py-2 font-medium text-right">Bunk in/cow</th>
            <th className="px-3 py-2 font-medium text-right">Bunk ft</th>
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((r) => (
            <tr
              key={r.group_id}
              className="border-t border-foreground/10"
            >
              <td className="px-3 py-2 font-medium">{r.group_label}</td>
              <td className="px-3 py-2 text-right">{r.estimated_head}</td>
              <td className="px-3 py-2 text-right">{r.stocking_pct}%</td>
              <td className="px-3 py-2 text-right">{r.pen_capacity}</td>
              <td className="px-3 py-2 text-right">{r.bunk_in_per_head}</td>
              <td className="px-3 py-2 text-right">{r.bunk_total_ft}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-foreground/20 font-medium">
            <td className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2 text-right">{plan.totals.estimated_head}</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-right">{plan.totals.pen_capacity}</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-right">{plan.totals.bunk_total_ft}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
