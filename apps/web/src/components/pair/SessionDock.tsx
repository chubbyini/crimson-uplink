"use client";

export interface DockSession {
  id: string;
  title: string;
  mode: string;
  phase: string;
  status: string;
  updatedAt: string;
  articleCount: number;
}

interface Props {
  sessions: DockSession[];
  hasMore: boolean;
  loadingMore: boolean;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onLoadMore: () => void;
  onDelete: (id: string, title: string) => void;
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/**
 * Sessions list: normal in-flow section. The panel keeps a fixed size
 * while the session cards scroll inside it; pagination is an explicit
 * "Load more" button below the scroll area.
 */
export default function SessionDock({
  sessions,
  hasMore,
  loadingMore,
  activeId,
  onOpen,
  onNew,
  onLoadMore,
  onDelete,
}: Props) {
  return (
    <section aria-label="All sessions" className="ui-panel mt-8 flex max-h-[26rem] flex-col p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Sessions</h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            {sessions.length}
            {hasMore ? "+" : ""} total · newest first
          </p>
        </div>
        <button onClick={onNew} className="btn-primary-sm ml-auto">
          + New
        </button>
      </div>

      {sessions.length === 0 && !loadingMore ? (
        <p className="mt-4 text-sm text-slate-500">
          No sessions yet — start one above.
        </p>
      ) : (
        <ul className="mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
          {sessions.map((s) => (
            <li key={s.id} className="min-w-0">
              <div
                className={`group relative rounded-xl border transition-colors ${
                  s.id === activeId
                    ? "border-red-600 bg-red-950/40"
                    : "border-slate-800 bg-white/[0.02] hover:bg-white/5"
                }`}
              >
                <button
                  onClick={() => onOpen(s.id)}
                  aria-current={s.id === activeId ? "true" : undefined}
                  className="block w-full p-3 pr-10 text-left"
                >
                  <span className="block truncate text-sm text-slate-200">{s.title}</span>
                  <span className="mt-1 block font-mono text-[10px] text-slate-500">
                    {s.mode} · {s.phase} · {s.articleCount}a · {s.status}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete session ${s.title}`}
                  title="Delete session"
                  onClick={() => onDelete(s.id, s.title)}
                  className="absolute top-2 right-2 rounded-lg border border-transparent p-1.5 text-slate-600 opacity-0 transition-colors group-hover:opacity-100 hover:border-red-900 hover:text-red-400 focus-visible:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {loadingMore && (
        <p className="mt-3 text-center font-mono text-[11px] text-slate-500">
          loading…
        </p>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button onClick={onLoadMore} disabled={loadingMore} className="btn-ghost">
            {loadingMore ? "Loading…" : "Load more sessions"}
          </button>
        </div>
      )}
    </section>
  );
}
