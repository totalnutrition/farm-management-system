import { QueryBuilder } from "./query-builder";

export const dynamic = "force-dynamic";

export default function QueryPage() {
  return (
    <div className="mx-auto w-full max-w-4xl py-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Query
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build a question in plain language. No syntax to learn.
      </p>
      <div className="mt-6">
        <QueryBuilder />
      </div>
    </div>
  );
}
