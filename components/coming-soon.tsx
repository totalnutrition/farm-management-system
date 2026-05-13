export function ComingSoon({
  title,
  description,
  note,
}: {
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">{title}</h1>
        <p className="text-xs text-muted-foreground">{description}</p>
      </header>
      <div className="ring-1 ring-foreground/10 p-6 flex flex-col gap-2">
        <h2 className="text-sm font-medium">Coming soon</h2>
        <p className="text-xs text-muted-foreground">
          {note ??
            "This section is reserved in the IA and ships in a follow-up PR."}
        </p>
      </div>
    </div>
  );
}
