/** Loading placeholders in the mission-control palette. */

export function CardSkeleton() {
  return (
    <div aria-hidden className="ui-panel animate-pulse p-5">
      <div className="h-3 w-24 rounded bg-slate-800" />
      <div className="mt-3 h-5 w-3/4 rounded bg-slate-800" />
      <div className="mt-2 h-3 w-full rounded bg-slate-800/70" />
      <div className="mt-1 h-3 w-2/3 rounded bg-slate-800/70" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-6 flex flex-col gap-4" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PageSkeleton({ title, rows = 4 }: { title: string; rows?: number }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="ui-title">{title}</h1>
      <ListSkeleton rows={rows} />
    </main>
  );
}
