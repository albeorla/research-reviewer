import type { RunJson } from "@rcc/shared";
import { Settings, FlaskConical } from "lucide-react";

interface Props {
  run: RunJson | null;
}

export function TopBar({ run }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
          <FlaskConical size={16} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">
            Research Consolidation Console
          </span>
          {run ? (
            <span className="mono text-[11px] text-slate-500">
              {run.run.id}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">No active run</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-ghost"
          aria-label="Settings"
          title="Settings (coming soon)"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
