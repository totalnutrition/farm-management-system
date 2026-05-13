import { cn } from "@/lib/utils"

type FarmInsightLogoProps = {
  className?: string
  /**
   * When true, the wordmark hides — useful inside sidebars that
   * collapse to icon-only. The "FI" pill always renders.
   */
  collapsible?: boolean
}

export function FarmInsightLogo({
  className,
  collapsible = false,
}: FarmInsightLogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-current", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-current">
        <span className="font-heading text-xs font-bold tracking-tight text-[var(--sidebar)]">
          FI
        </span>
      </div>
      <span
        className={cn(
          "font-heading text-lg font-semibold tracking-tight leading-none truncate",
          collapsible &&
            "group-data-[collapsible=icon]:hidden",
        )}
      >
        FarmInsight
      </span>
    </div>
  )
}
