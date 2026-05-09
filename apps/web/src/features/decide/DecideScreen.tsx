import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { pipelineApi } from "@/lib/apiPipeline";
import {
  CheckCircle2,
  ChevronRight,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import clsx from "clsx";

const FINAL_PATH = "decision/50-consolidated-decision.md";
const REDTEAM_PATH = "decision/40-final-red-team-check.md";

export function DecideScreen() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => (runId ? api.getRun(runId) : Promise.reject("no run")),
    enabled: Boolean(runId),
    refetchInterval: 5_000,
  });

  const finalQuery = useQuery({
    queryKey: ["file", runId, FINAL_PATH],
    queryFn: () => pipelineApi.fileContent(runId!, FINAL_PATH),
    enabled: Boolean(runId),
    retry: false,
  });
  const redteamQuery = useQuery({
    queryKey: ["file", runId, REDTEAM_PATH],
    queryFn: () => pipelineApi.fileContent(runId!, REDTEAM_PATH),
    enabled: Boolean(runId),
    retry: false,
  });

  const rerunFinal = useMutation({
    mutationFn: () =>
      pipelineApi.runStage(runId!, "final_decision", { rerunFromHere: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(["run", runId], data.run);
      queryClient.invalidateQueries({ queryKey: ["file", runId, FINAL_PATH] });
    },
  });
  const rerunRedTeam = useMutation({
    mutationFn: () =>
      pipelineApi.runStage(runId!, "final_red_team", { rerunFromHere: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(["run", runId], data.run);
      queryClient.invalidateQueries({
        queryKey: ["file", runId, REDTEAM_PATH],
      });
    },
  });
  const rerunFull = useMutation({
    mutationFn: () => pipelineApi.startReview(runId!),
    onSuccess: () => navigate(`/runs/${runId}/review`),
  });

  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    setAccepted(false);
  }, [runId]);

  const finalReady =
    runQuery.data?.pipeline.stages.final_decision?.status === "complete";
  const redTeamReady =
    runQuery.data?.pipeline.stages.final_red_team?.status === "complete";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">⑤ Review Final Decision</h1>
          <p className="mt-1 text-sm text-slate-400">
            Inspect the final consolidated decision side-by-side with the
            red-team check before exporting.
          </p>
        </div>
        {accepted ? (
          <span className="pill-success">
            <CheckCircle2 size={12} /> Accepted
          </span>
        ) : finalReady ? (
          <span className="pill-info">● Ready to accept</span>
        ) : (
          <span className="pill-neutral">○ Pipeline incomplete</span>
        )}
      </header>

      {!finalReady && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="card-body text-sm text-amber-200">
            The final decision artifact is not yet on disk. Complete the
            review pipeline first.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => navigate(`/runs/${runId}/review`)}
            >
              Go to Review
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <ArtifactCard
            title="Final decision"
            subtitle="decision/50-consolidated-decision.md"
            content={finalQuery.data?.content ?? null}
            loading={finalQuery.isFetching}
            ready={finalReady}
          />
          <ArtifactCard
            title="Red-team check"
            subtitle="decision/40-final-red-team-check.md"
            content={redteamQuery.data?.content ?? null}
            loading={redteamQuery.isFetching}
            ready={redTeamReady}
          />
        </section>

        <aside className="space-y-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-300" />
                Review controls
              </h2>
            </div>
            <div className="card-body space-y-2">
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={!finalReady || rerunFinal.isPending}
                onClick={() => rerunFinal.mutate()}
              >
                <RotateCw
                  size={14}
                  className={rerunFinal.isPending ? "animate-spin" : ""}
                />
                {rerunFinal.isPending ? "Rerunning..." : "Rerun final decision"}
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={!redTeamReady || rerunRedTeam.isPending}
                onClick={() => rerunRedTeam.mutate()}
              >
                <RotateCw
                  size={14}
                  className={rerunRedTeam.isPending ? "animate-spin" : ""}
                />
                {rerunRedTeam.isPending ? "Rerunning..." : "Rerun red-team"}
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => rerunFull.mutate()}
                disabled={rerunFull.isPending}
              >
                Rerun full review
              </button>
              {(rerunFinal.isError ||
                rerunRedTeam.isError ||
                rerunFull.isError) && (
                <p className="text-xs text-red-300">
                  {(
                    rerunFinal.error ??
                    rerunRedTeam.error ??
                    rerunFull.error
                  )?.toString()}
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold">Accept</h2>
            </div>
            <div className="card-body text-sm text-slate-300 space-y-3">
              <p>
                Accepting marks the decision ready for export. Run.json keeps
                an audit trail; nothing is destroyed.
              </p>
              <button
                type="button"
                className={clsx(
                  "btn-primary w-full",
                  accepted && "opacity-70",
                )}
                disabled={!finalReady}
                onClick={() => setAccepted(true)}
              >
                <CheckCircle2 size={14} />
                {accepted ? "Accepted" : "Accept final"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={!accepted}
          onClick={() => navigate(`/runs/${runId}/export`)}
        >
          Export
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ArtifactCard({
  title,
  subtitle,
  content,
  loading,
  ready,
}: {
  title: string;
  subtitle: string;
  content: string | null;
  loading: boolean;
  ready: boolean;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mono text-[11px] text-slate-500">{subtitle}</p>
        </div>
        {ready ? (
          <span className="pill-success">✓ Ready</span>
        ) : (
          <span className="pill-neutral">○ Pending</span>
        )}
      </div>
      <div className="card-body">
        {loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : content ? (
          <pre className="mono whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-200 max-h-[24rem] overflow-y-auto p-3 bg-slate-950/50 rounded-md border border-slate-800">
            {content}
          </pre>
        ) : (
          <p className="text-xs text-slate-500">
            No artifact yet. Run the pipeline first.
          </p>
        )}
      </div>
    </div>
  );
}
