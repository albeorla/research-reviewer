import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PIPELINE_STAGE_LABELS,
  RunEvent,
  RunJson,
  StageState,
  type PipelineStage,
} from "@rcc/shared";
import { api } from "@/lib/api";
import { openEventStream, pipelineApi } from "@/lib/apiPipeline";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Loader2,
  Play,
  RotateCw,
  Square,
} from "lucide-react";
import clsx from "clsx";

const REVIEW_STAGES: PipelineStage[] = [
  "source_audit",
  "evidence_critic",
  "decision_critic",
  "contrarian_critic",
  "critique_synthesis",
  "decision_draft",
  "final_red_team",
  "final_decision",
];

interface LogBuffer {
  stdout: string;
  stderr: string;
}

export function ReviewScreen() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => (runId ? api.getRun(runId) : Promise.reject("no run")),
    enabled: Boolean(runId),
    refetchInterval: 30_000,
  });

  const [logs, setLogs] = useState<Record<string, LogBuffer>>({});
  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [selected, setSelected] = useState<PipelineStage>("source_audit");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open SSE stream for this run; close on cleanup.
  useEffect(() => {
    if (!runId) return;
    const close = openEventStream(runId, (event) => {
      handleEvent(event, {
        setLogs,
        setActiveStage,
        setRunning,
        queryClient,
        runId,
      });
    });
    return close;
  }, [runId, queryClient]);

  const startMutation = useMutation({
    mutationFn: (fromStage?: PipelineStage) =>
      pipelineApi.startReview(runId!, fromStage ? { fromStage } : undefined),
    onSuccess: (data) => {
      setRunning(true);
      setError(null);
      setLogs({});
      queryClient.setQueryData(["run", runId], data.run);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
  });

  const rerunStageMutation = useMutation({
    mutationFn: (stage: PipelineStage) =>
      pipelineApi.runStage(runId!, stage, { rerunFromHere: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(["run", runId], data.run);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => pipelineApi.cancel(runId!),
    onSuccess: () => setRunning(false),
  });

  const run = runQuery.data;
  const stages = run?.pipeline.stages ?? {};
  const failedStages = REVIEW_STAGES.filter(
    (s) => stages[s]?.status === "failed",
  );

  const allComplete =
    run &&
    REVIEW_STAGES.every((s) => stages[s]?.status === "complete");

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">④ Review Pipeline</h1>
          <p className="mt-1 text-sm text-slate-400">
            Run source audit, three critics, critique synthesis, decision
            draft, red-team check, and final decision.
          </p>
        </div>
        <PipelineStatusPill running={running} allComplete={!!allComplete} />
      </header>

      {error && (
        <div className="card border-red-500/30 bg-red-500/5">
          <div className="card-body text-sm text-red-300">{error}</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <div className="card-header">
            <h2 className="text-sm font-semibold">Stages</h2>
            <div className="flex items-center gap-1.5">
              {!running && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={startMutation.isPending}
                  onClick={() => startMutation.mutate(undefined)}
                >
                  <Play size={14} />
                  {allComplete ? "Run again" : "Run full review"}
                </button>
              )}
              {running && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => cancelMutation.mutate()}
                >
                  <Square size={14} />
                  Cancel
                </button>
              )}
            </div>
          </div>
          <ul className="card-body space-y-1 p-2">
            {REVIEW_STAGES.map((s) => {
              const state = stages[s];
              const isActive = selected === s;
              const isLive = activeStage === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    className={clsx(
                      "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isActive
                        ? "bg-slate-800/80 text-slate-100"
                        : "hover:bg-slate-800/40 text-slate-300",
                    )}
                    onClick={() => setSelected(s)}
                  >
                    <StageIcon
                      status={state?.status ?? "pending"}
                      live={isLive}
                    />
                    <span className="flex-1 truncate">
                      {PIPELINE_STAGE_LABELS[s]}
                    </span>
                    {state?.durationMs != null && state.status === "complete" && (
                      <span className="mono text-[11px] text-slate-500">
                        {(state.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {failedStages.length > 0 && !running && (
            <div className="card-body border-t border-slate-800">
              <p className="text-xs text-amber-300 mb-2">
                {failedStages.length} stage(s) failed
              </p>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => startMutation.mutate(failedStages[0])}
              >
                <RotateCw size={14} />
                Re-run from {PIPELINE_STAGE_LABELS[failedStages[0]!]}
              </button>
            </div>
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                {PIPELINE_STAGE_LABELS[selected]}
              </h2>
              <StageHeaderPill state={stages[selected]} />
            </div>
            {stages[selected]?.status === "failed" && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => rerunStageMutation.mutate(selected)}
                disabled={rerunStageMutation.isPending}
              >
                <RotateCw size={14} />
                Rerun stage
              </button>
            )}
          </div>
          <div className="card-body space-y-3">
            <StageBody
              runId={runId!}
              stage={selected}
              state={stages[selected]}
              live={activeStage === selected}
              log={logs[selected]}
            />
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!allComplete}
          onClick={() => navigate(`/runs/${runId}/decide`)}
        >
          Review final decision
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

interface StageBodyProps {
  runId: string;
  stage: PipelineStage;
  state: StageState | undefined;
  live: boolean;
  log: LogBuffer | undefined;
}

function StageBody({ runId, stage, state, live, log }: StageBodyProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (state?.status !== "complete" || !state.outputPath) {
      setContent(null);
      return;
    }
    // outputPath is absolute; convert to relative for the files endpoint.
    const rel = state.outputPath.split("/").slice(-2).join("/");
    let cancelled = false;
    setLoadingContent(true);
    pipelineApi
      .fileContent(runId, rel)
      .then((r) => {
        if (!cancelled) setContent(r.content);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingContent(false));
    return () => {
      cancelled = true;
    };
  }, [runId, stage, state?.status, state?.outputPath]);

  if (live) {
    return <LogPanel log={log} />;
  }
  if (state?.status === "failed") {
    return (
      <div className="space-y-3">
        <div className="card border-red-500/30 bg-red-500/5">
          <div className="card-body text-sm text-red-300">
            <p className="font-medium">
              Exit code {state.exitCode ?? "?"} —{" "}
              {state.error?.split("\n")[0] ?? "Unknown error"}
            </p>
            {state.error && state.error.includes("\n") && (
              <pre className="mt-2 mono text-[12px] whitespace-pre-wrap text-red-300/80">
                {state.error}
              </pre>
            )}
          </div>
        </div>
        {log && <LogPanel log={log} />}
      </div>
    );
  }
  if (state?.status === "complete") {
    return (
      <div className="space-y-2">
        <div className="text-[11px] text-slate-500 mono">
          {state.outputPath}
        </div>
        {loadingContent ? (
          <p className="text-xs text-slate-400">Loading artifact...</p>
        ) : content ? (
          <pre className="mono whitespace-pre-wrap text-[12.5px] text-slate-200 leading-relaxed max-h-[28rem] overflow-y-auto p-3 bg-slate-950/50 rounded-md border border-slate-800">
            {content}
          </pre>
        ) : (
          <p className="text-xs text-slate-500">No artifact written.</p>
        )}
      </div>
    );
  }
  return (
    <div className="text-sm text-slate-400">
      Stage has not run yet. Click{" "}
      <span className="text-slate-200">Run full review</span> to start.
    </div>
  );
}

function LogPanel({ log }: { log: LogBuffer | undefined }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log?.stdout, log?.stderr]);
  if (!log || (!log.stdout && !log.stderr)) {
    return (
      <p className="text-xs text-slate-400">
        Stage running. Logs will stream here as they arrive.
      </p>
    );
  }
  return (
    <pre
      ref={ref}
      className="mono whitespace-pre-wrap text-[12px] text-slate-200 leading-relaxed max-h-[28rem] overflow-y-auto p-3 bg-slate-950/70 rounded-md border border-slate-800"
    >
      {log.stdout}
      {log.stderr && (
        <span className="text-amber-300">{"\n--- stderr ---\n" + log.stderr}</span>
      )}
    </pre>
  );
}

function StageIcon({
  status,
  live,
}: {
  status: string;
  live: boolean;
}) {
  if (live || status === "running")
    return <Loader2 size={14} className="text-indigo-300 animate-spin" />;
  if (status === "complete")
    return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (status === "failed")
    return <AlertCircle size={14} className="text-red-400" />;
  return <CircleDashed size={14} className="text-slate-600" />;
}

function StageHeaderPill({ state }: { state: StageState | undefined }) {
  if (!state || state.status === "pending")
    return <span className="pill-neutral">○ Pending</span>;
  if (state.status === "running")
    return <span className="pill-info">● Running</span>;
  if (state.status === "complete")
    return <span className="pill-success">✓ Complete</span>;
  if (state.status === "failed")
    return <span className="pill-danger">✕ Failed</span>;
  return <span className="pill-warning">↷ Skipped</span>;
}

function PipelineStatusPill({
  running,
  allComplete,
}: {
  running: boolean;
  allComplete: boolean;
}) {
  if (running) return <span className="pill-info">● Running pipeline</span>;
  if (allComplete) return <span className="pill-success">✓ Complete</span>;
  return <span className="pill-neutral">— Idle</span>;
}

interface HandlerCtx {
  setLogs: React.Dispatch<React.SetStateAction<Record<string, LogBuffer>>>;
  setActiveStage: React.Dispatch<React.SetStateAction<PipelineStage | null>>;
  setRunning: React.Dispatch<React.SetStateAction<boolean>>;
  queryClient: ReturnType<typeof useQueryClient>;
  runId: string;
}

function handleEvent(event: RunEvent, ctx: HandlerCtx): void {
  if (event.type === "stage_started") {
    ctx.setActiveStage(event.stage as PipelineStage);
    ctx.setLogs((prev) => ({
      ...prev,
      [event.stage]: { stdout: "", stderr: "" },
    }));
    ctx.setRunning(true);
  } else if (event.type === "stage_log") {
    ctx.setLogs((prev) => {
      const cur = prev[event.stage] ?? { stdout: "", stderr: "" };
      return {
        ...prev,
        [event.stage]:
          event.stream === "stderr"
            ? { ...cur, stderr: cur.stderr + event.text }
            : { ...cur, stdout: cur.stdout + event.text },
      };
    });
  } else if (event.type === "stage_completed") {
    ctx.setActiveStage((cur) => (cur === event.stage ? null : cur));
  } else if (event.type === "stage_failed") {
    ctx.setActiveStage((cur) => (cur === event.stage ? null : cur));
  } else if (event.type === "run_updated") {
    ctx.queryClient.setQueryData(["run", ctx.runId], event.run as RunJson);
    // If no stages are running, mark idle.
    const stages = (event.run as RunJson).pipeline.stages;
    const anyRunning = Object.values(stages).some(
      (s) => s.status === "running",
    );
    if (!anyRunning) ctx.setRunning(false);
  }
}
