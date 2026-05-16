import { cn } from "@/lib/utils"

type FarmInsightLogoProps = {
  className?: string
}

export function FarmInsightLogo({ className }: FarmInsightLogoProps) {
  return (
    <div className={cn("flex flex-row items-center gap-2 text-current", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-current">
        <span className="font-heading text-sm font-bold tracking-tight text-[var(--sidebar)]">
          FI
        </span>
      </div>
      <div className="flex h-10 flex-col justify-center leading-tight">
        <span className="font-heading text-sm font-semibold tracking-tight">Farm</span>
        <span className="font-heading text-sm font-semibold tracking-tight">Insight</span>
      </div>
    </div>
  )
}
