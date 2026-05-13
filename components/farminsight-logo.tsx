import { cn } from "@/lib/utils"

type FarmInsightLogoProps = {
  className?: string
}

export function FarmInsightLogo({ className }: FarmInsightLogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-current", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-current">
        <span className="font-heading text-xs font-bold tracking-tight text-[var(--sidebar)]">
          FI
        </span>
      </div>
      <span className="font-heading text-lg font-semibold tracking-tight leading-none">
        FarmInsight
      </span>
    </div>
  )
}
