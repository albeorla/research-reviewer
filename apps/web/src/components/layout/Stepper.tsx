import { Link, useLocation, useParams } from "react-router-dom";
import {
  WIZARD_STEPS,
  WIZARD_STEP_LABELS,
  type WizardStep,
  type RunJson,
} from "@rcc/shared";
import { Check, Circle, CircleDot } from "lucide-react";
import clsx from "clsx";

interface Props {
  run: RunJson | null;
}

export function Stepper({ run }: Props) {
  const location = useLocation();
  const { runId } = useParams();
  const current = stepFromPath(location.pathname);

  return (
    <nav aria-label="Workflow steps">
      <p className="label mb-2">Workflow</p>
      <ol className="space-y-1">
        {WIZARD_STEPS.map((step, idx) => {
          const status = stepStatus(step, current, run);
          const enabled = run !== null || step === "define";
          const target = stepUrl(step, run, runId);
          const Inner = (
            <span className="flex items-center gap-2 text-sm">
              <StepIcon status={status} />
              <span
                className={clsx(
                  "tabular-nums text-slate-500 mono text-[11px] w-3 inline-block text-right",
                )}
              >
                {idx + 1}
              </span>
              <span
                className={clsx(
                  status === "current" && "text-slate-100 font-medium",
                  status === "done" && "text-slate-300",
                  status === "todo" && "text-slate-500",
                )}
              >
                {WIZARD_STEP_LABELS[step]}
              </span>
            </span>
          );
          return (
            <li key={step}>
              {enabled ? (
                <Link
                  to={target}
                  className={clsx(
                    "block rounded-md px-2 py-1.5 transition-colors hover:bg-slate-800/50",
                    status === "current" && "bg-slate-800/60",
                  )}
                >
                  {Inner}
                </Link>
              ) : (
                <span
                  className="block rounded-md px-2 py-1.5 opacity-60"
                  title="Create a run to unlock"
                >
                  {Inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type StepStatus = "done" | "current" | "todo";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <Check size={14} className="text-emerald-400" />;
  if (status === "current")
    return <CircleDot size={14} className="text-indigo-300" />;
  return <Circle size={14} className="text-slate-600" />;
}

function stepStatus(
  step: WizardStep,
  current: WizardStep,
  run: RunJson | null,
): StepStatus {
  const order = WIZARD_STEPS.indexOf(step);
  const currentOrder = WIZARD_STEPS.indexOf(current);
  if (order === currentOrder) return "current";
  if (order < currentOrder) return "done";
  // Forward steps are "done" if their underlying artifacts exist on the run.
  if (!run) return "todo";
  if (step === "define") return "done";
  return "todo";
}

export function stepFromPath(pathname: string): WizardStep {
  if (pathname.includes("/enrich")) return "enrich";
  if (pathname.includes("/collect")) return "collect";
  if (pathname.includes("/review")) return "review";
  if (pathname.includes("/decide")) return "decide";
  if (pathname.includes("/export")) return "export";
  return "define";
}

function stepUrl(
  step: WizardStep,
  run: RunJson | null,
  routeRunId: string | undefined,
): string {
  const id = run?.run.id ?? routeRunId;
  if (!id) return "/runs/new";
  return `/runs/${id}/${step}`;
}
