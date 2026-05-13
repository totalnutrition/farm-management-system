import { cn } from "@/lib/utils"

type FarmInsightLogoProps = {
  className?: string
}

export function FarmInsightLogo({ className }: FarmInsightLogoProps) {
  return (
    <div className={cn("flex flex-col items-start gap-2 text-current", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-current">
        <span className="font-heading text-sm font-bold tracking-tight text-[var(--sidebar)]">
          FI
        </span>
      </div>
      <div className="flex items-baseline gap-[2px] leading-none">
        <span className="font-heading text-lg font-semibold tracking-tight">Farm</span>
        <span className="font-heading text-lg font-semibold tracking-tight italic">Insight</span>
      </div>
    </div>
  )
}
