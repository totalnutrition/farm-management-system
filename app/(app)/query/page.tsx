import { QueryBuilder } from "./query-builder";

export const dynamic = "force-dynamic";

export default function QueryPage() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Query</h1>
        <p className="text-xs text-muted-foreground">
          Build a question in plain language. No syntax to learn.
        </p>
      </header>
      <QueryBuilder />
    </div>
  );
}
