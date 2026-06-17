import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MIN_ACTIVE_SOURCES,
  SOURCE_NAMES,
  SOURCE_NAME_LABELS,
  activeSourceNames,
  type SourceName,
} from "@rcc/shared";
import { sourcesApi, type SourceContent } from "@/lib/apiSources";
import { enrichApi } from "@/lib/apiEnrich";
import { pipelineApi } from "@/lib/apiPipeline";
import { SourceCard } from "./SourceCard";
import { ChevronRight, ListChecks, Plus } from "lucide-react";
import clsx from "clsx";

export function CollectScreen() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({
    queryKey: ["sources", runId],
    queryFn: () => (runId ? sourcesApi.list(runId) : Promise.reject("no run")),
    enabled: Boolean(runId),
  });
  const enrichQuery = useQuery({
    queryKey: ["enrich", runId],
    queryFn: () => (runId ? enrichApi.get(runId) : Promise.reject("no run")),
    enabled: Boolean(runId),
  });

  const sources = sourcesQuery.data?.sources;
  const run = sourcesQuery.data?.run;
  const stage = run?.pipeline.stages.source_audit;
  const skipEnrichment = run?.inputs.skipEnrichment ?? false;
  // The prompt operators copy into each model UI: the enriched prompt, or the
  // raw idea when enrichment was skipped.
  const effectivePrompt = skipEnrichment
    ? enrichQuery.data?.originalIdea ?? ""
    : enrichQuery.data?.enrichedPrompt ?? "";

  const activeNames = useMemo<SourceName[]>(
    () => (run ? activeSourceNames(run) : [...SOURCE_NAMES]),
    [run],
  );
  const excludedNames = useMemo<SourceName[]>(
    () => SOURCE_NAMES.filter((n) => !activeNames.includes(n)),
    [activeNames],
  );

  const auditMutation = useMutation({
    mutationFn: () => pipelineApi.runStage(runId!, "source_audit"),
    onSuccess: (data) => {
      queryClient.setQueryData(["run", runId], data.run);
      queryClient.invalidateQueries({ queryKey: ["sources", runId] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { name: SourceName; enabled: boolean }) =>
      sourcesApi.setEnabled(runId!, vars.name, vars.enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(["sources", runId], data);
      queryClient.setQueryData(["run", runId], data.run);
    },
  });

  const counts = useMemo(
    () => countSources(sources, activeNames),
    [sources, activeNames],
  );
  const activeCount = activeNames.length;
  const tooFew = activeCount < MIN_ACTIVE_SOURCES;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">③ Collect Model Research</h1>
        <p className="mt-1 text-sm text-slate-400">
          Paste each model's full markdown result or point at a local file.
        </p>
      </header>

      {sources && (
        <div className="card">
          <div className="card-body flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-300">Overall:</span>
            {SOURCE_NAMES.map((n) => (
              <SummaryTag
                key={n}
                name={n}
                status={sources[n]?.state.validation.status ?? "error"}
                saved={!!sources[n]?.state.savedAt}
                excluded={excludedNames.includes(n)}
              />
            ))}
            <span className="ml-auto text-[11px] text-slate-500">
              {activeCount} active · {counts.valid} valid · {counts.warning}{" "}
              warning · {counts.error} error · {counts.empty} missing
            </span>
          </div>
        </div>
      )}

      {skipEnrichment ? (
        <div className="card border-slate-700 bg-slate-800/30">
          <div className="card-body text-sm text-slate-300">
            Enrichment skipped — each Copy-prompt button copies your raw idea.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => navigate(`/runs/${runId}/enrich`)}
            >
              Enrich instead
            </button>
          </div>
        </div>
      ) : (
        !effectivePrompt && (
          <div className="card border-amber-500/30 bg-amber-500/5">
            <div className="card-body text-sm text-amber-200">
              Enrich the research prompt first so each Copy-prompt button has
              something to copy.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => navigate(`/runs/${runId}/enrich`)}
              >
                Go to Enrich
              </button>
            </div>
          </div>
        )
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {sources &&
          activeNames.map((n) => (
            <SourceCard
              key={n}
              runId={runId!}
              name={n}
              state={sources[n].state}
              serverContent={sources[n].content}
              prompt={effectivePrompt}
              onExclude={() =>
                toggleMutation.mutate({ name: n, enabled: false })
              }
              excluding={toggleMutation.isPending}
            />
          ))}
      </div>

      {excludedNames.length > 0 && (
        <div className="card">
          <div className="card-body flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-400">Excluded providers:</span>
            {excludedNames.map((n) => (
              <button
                key={n}
                type="button"
                className="btn-ghost text-xs"
                disabled={toggleMutation.isPending}
                onClick={() =>
                  toggleMutation.mutate({ name: n, enabled: true })
                }
                title="Include this provider in the run"
              >
                <Plus size={12} />
                {SOURCE_NAME_LABELS[n]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks size={14} className="text-indigo-300" />
            Source audit
          </h2>
          <AuditPill stage={stage?.status} />
        </div>
        <div className="card-body space-y-3 text-sm text-slate-300">
          <p>
            Mechanical validation already runs on every save (length, headings,
            refusals, near-duplicates). Click below to also run the LLM-based
            audit, which writes{" "}
            <span className="mono text-slate-200">
              review/10-source-audit.md
            </span>{" "}
            and surfaces cross-source disagreements.
          </p>
          {auditMutation.isError && (
            <p className="text-xs text-red-300">
              {auditMutation.error instanceof Error
                ? auditMutation.error.message
                : String(auditMutation.error)}
            </p>
          )}
          {stage?.status === "complete" && stage.outputPath && (
            <p className="text-[11px] text-slate-500 mono">
              Wrote {stage.outputPath} ({Math.round((stage.durationMs ?? 0) / 100) / 10}s)
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => auditMutation.mutate()}
              disabled={
                auditMutation.isPending ||
                counts.error > 0 ||
                counts.empty > 0 ||
                tooFew
              }
              title={
                tooFew
                  ? `Enable at least ${MIN_ACTIVE_SOURCES} providers first.`
                  : counts.empty > 0
                    ? "Save every enabled provider first."
                    : counts.error > 0
                      ? "Resolve hard-duplicate or empty-source errors first."
                      : undefined
              }
            >
              <ListChecks size={14} />
              {auditMutation.isPending
                ? "Running source audit..."
                : stage?.status === "complete"
                  ? "Re-run source audit"
                  : "Run source audit"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {tooFew && (
          <span className="text-xs text-amber-300">
            Enable at least {MIN_ACTIVE_SOURCES} providers
          </span>
        )}
        {!tooFew && counts.empty > 0 && (
          <span className="text-xs text-amber-300">
            {counts.empty} of {activeCount} sources missing
          </span>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={
            tooFew || counts.empty > 0 || stage?.status !== "complete"
          }
          onClick={() => navigate(`/runs/${runId}/review`)}
          title={
            tooFew
              ? `Enable at least ${MIN_ACTIVE_SOURCES} providers first`
              : counts.empty > 0
                ? "Save every enabled provider first"
                : stage?.status !== "complete"
                  ? "Run the source audit first"
                  : undefined
          }
        >
          Review pipeline
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function countSources(
  sources: Record<SourceName, SourceContent> | undefined,
  activeNames: SourceName[],
) {
  if (!sources) return { valid: 0, warning: 0, error: 0, empty: 0 };
  let valid = 0;
  let warning = 0;
  let error = 0;
  let empty = 0;
  for (const n of activeNames) {
    const s = sources[n];
    if (!s?.state.savedAt) {
      empty += 1;
      continue;
    }
    const st = s.state.validation.status;
    if (st === "valid") valid += 1;
    else if (st === "warning") warning += 1;
    else error += 1;
  }
  return { valid, warning, error, empty };
}

function SummaryTag({
  name,
  status,
  saved,
  excluded,
}: {
  name: SourceName;
  status: "valid" | "warning" | "error";
  saved: boolean;
  excluded: boolean;
}) {
  const sym = excluded
    ? "—"
    : !saved
      ? "○"
      : status === "valid"
        ? "✓"
        : status === "warning"
          ? "⚠"
          : "✕";
  const cls = excluded
    ? "text-slate-600 line-through"
    : !saved
      ? "text-slate-500"
      : status === "valid"
        ? "text-emerald-300"
        : status === "warning"
          ? "text-amber-300"
          : "text-red-300";
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs", cls)}>
      <span>{sym}</span>
      <span>{SOURCE_NAME_LABELS[name]}</span>
    </span>
  );
}

function AuditPill({ stage }: { stage?: string }) {
  if (stage === "running") return <span className="pill-info">● Running</span>;
  if (stage === "complete")
    return <span className="pill-success">✓ Complete</span>;
  if (stage === "failed") return <span className="pill-danger">✕ Failed</span>;
  return <span className="pill-neutral">○ Not run</span>;
}
