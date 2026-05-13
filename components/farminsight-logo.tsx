import { cn } from "@/lib/utils"

type FarmInsightLogoProps = {
  className?: string
  tagline?: string
  showTagline?: boolean
}

export function FarmInsightLogo({
  className,
  tagline = "Empowering Precision",
  showTagline = true,
}: FarmInsightLogoProps) {
  return (
    <div className={cn("flex flex-col items-start gap-1 text-current", className)}>
      <div className="flex items-center gap-2">
        <CowMark className="h-9 w-12 shrink-0" />
        <div className="flex items-baseline gap-[2px] leading-none">
          <span className="font-heading text-3xl font-bold tracking-tight">Farm</span>
          <span className="font-heading text-3xl font-bold tracking-tight italic">Insight</span>
          <span className="ml-[2px] text-[10px] font-semibold opacity-80">®</span>
        </div>
      </div>
      {showTagline && (
        <div className="pl-[3.25rem] text-[11px] font-medium uppercase tracking-[0.18em] opacity-75">
          {tagline}
        </div>
      )}
    </div>
  )
}

function CowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 64"
      className={className}
      aria-hidden="true"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <path d="M14 38c0-9 7-15 17-15h28c10 0 17 5 19 13l4 2c2 1 3 3 3 5 0 3-2 5-5 5h-4v6c0 2-2 4-4 4h-3c-2 0-4-2-4-4v-3H32v3c0-2-2 4-4 4h-3c-2 0-4-2-4-4v-7c-3-1-7-3-7-5z" />
      {/* Head */}
      <path d="M70 21c4-1 7-3 9-7 1-2 3-3 5-2 2 1 2 3 1 5-1 3-1 5 0 7 1 3-1 5-4 6-2 1-5 1-7 0z" />
      {/* Ear */}
      <path d="M82 12c2-2 4-2 5 0 1 2 0 4-2 5-2 0-3-1-3-3z" />
      {/* Horn */}
      <path d="M85 7c1-2 3-2 3 0 0 1-1 3-2 3-1 0-1-2-1-3z" />
      {/* Legs */}
      <rect x="22" y="48" width="5" height="14" rx="1" />
      <rect x="36" y="48" width="5" height="14" rx="1" />
      <rect x="58" y="48" width="5" height="14" rx="1" />
      <rect x="72" y="48" width="5" height="14" rx="1" />
      {/* Tail */}
      <path d="M14 36c-3-1-6-1-8 1-1 1-1 3 1 3 2 1 4 0 6-1z" />
      {/* Spots (slightly lighter) */}
      <g opacity="0.35">
        <ellipse cx="32" cy="34" rx="5" ry="4" fill="#FFFFFF" />
        <ellipse cx="52" cy="38" rx="6" ry="4" fill="#FFFFFF" />
        <ellipse cx="68" cy="32" rx="4" ry="3" fill="#FFFFFF" />
      </g>
      {/* Eye */}
      <circle cx="78" cy="22" r="1.2" fill="#2A2520" />
    </svg>
  )
}
