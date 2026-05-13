import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon } from "@hugeicons/core-free-icons";

export function NoLocationSelected({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <HugeiconsIcon icon={Location01Icon} className="size-8 text-muted-foreground" />
      <h1 className="font-heading text-base font-medium">{title}</h1>
      <p className="text-xs text-muted-foreground max-w-md">
        {hint ??
          "Pick a location from the switcher in the top-right, or create one in Settings → Locations."}
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/settings/locations">Go to Locations</Link>
      </Button>
    </div>
  );
}
