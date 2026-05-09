import type { RunJson } from "@rcc/shared";
import { Stepper } from "./Stepper";
import { ArtifactTree } from "./ArtifactTree";

interface Props {
  run: RunJson | null;
}

export function Sidebar({ run }: Props) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950/80 lg:flex">
      <div className="border-b border-slate-800 p-4">
        <p className="label">Run</p>
        {run ? (
          <div className="mt-2 space-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Slug
              </p>
              <p className="mono text-sm text-slate-200 break-all">
                {run.run.slug}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Date
              </p>
              <p className="mono text-sm text-slate-200">{run.run.date}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Output
              </p>
              <p
                className="mono text-[11px] text-slate-300 break-all"
                title={run.run.runDir}
              >
                {abbreviatePath(run.run.runDir)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Create a run to see metadata here.
          </p>
        )}
      </div>
      <div className="border-b border-slate-800 p-4">
        <Stepper run={run} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ArtifactTree run={run} />
      </div>
    </aside>
  );
}

function abbreviatePath(p: string): string {
  if (p.length <= 38) return p;
  const parts = p.split("/");
  if (parts.length < 4) return p;
  return `${parts[0]}/.../${parts.slice(-2).join("/")}`;
}
