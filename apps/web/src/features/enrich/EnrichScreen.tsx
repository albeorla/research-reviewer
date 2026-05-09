import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approxTokenCount,
  SOURCE_NAMES,
  SOURCE_NAME_LABELS,
  wordCount,
} from "@rcc/shared";
import { enrichApi } from "@/lib/apiEnrich";
import { CopyButton } from "@/components/ui/CopyButton";
import { ChevronRight, RefreshCw, Save, Sparkles } from "lucide-react";
import clsx from "clsx";

export function EnrichScreen() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const enrichQuery = useQuery({
    queryKey: ["enrich", runId],
    queryFn: () => (runId ? enrichApi.get(runId) : Promise.reject("no run")),
    enabled: Boolean(runId),
  });

  const [draft, setDraft] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Hydrate draft when query data arrives.
  useEffect(() => {
    const remote = enrichQuery.data?.enrichedPrompt;
    if (remote != null && !dirty) setDraft(remote);
  }, [enrichQuery.data?.enrichedPrompt, dirty]);

  const generateMutation = useMutation({
    mutationFn: () => enrichApi.trigger(runId!, { regenerate: true }),
    onSuccess: (data) => {
      setActionError(null);
      setDraft(data.enrichedPrompt);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["enrich", runId] });
      queryClient.setQueryData(["run", runId], data.run);
    },
    onError: (e: unknown) =>
      setActionError(e instanceof Error ? e.message : String(e)),
  });

  const saveMutation = useMutation({
    mutationFn: () => enrichApi.trigger(runId!, { prompt: draft }),
    onSuccess: (data) => {
      setActionError(null);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["enrich", runId] });
      queryClient.setQueryData(["run", runId], data.run);
    },
    onError: (e: unknown) =>
      setActionError(e instanceof Error ? e.message : String(e)),
  });

  const stage = enrichQuery.data?.run.pipeline.stages.prompt_enrichment;
  const modelInstructions = enrichQuery.data?.modelInstructions ?? "";
  const hasContent = Boolean(draft.trim());
  const generating = generateMutation.isPending;
  const saving = saveMutation.isPending;
  const words = useMemo(() => wordCount(draft), [draft]);
  const tokens = useMemo(() => approxTokenCount(draft), [draft]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">② Enrich Research Prompt</h1>
          <p className="mt-1 text-sm text-slate-400">
            Turn the rough idea into a rigorous prompt to run across five model
            UIs.
          </p>
        </div>
        <StatusPill
          stage={stage?.status}
          generating={generating}
          dirty={dirty}
          empty={!hasContent}
        />
      </header>

      {actionError && (
        <div className="card border-red-500/30 bg-red-500/5">
          <div className="card-body text-sm text-red-300">
            <p className="font-medium">{actionError}</p>
            {stage?.error && stage.error !== actionError && (
              <p className="mt-1 mono text-[12px] text-red-300/80 whitespace-pre-wrap">
                {stage.error}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-3">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  01-enriched-research-prompt.md
                </h2>
                <span className="text-[11px] text-slate-500 mono">
                  {words.toLocaleString()} words · ~
                  {tokens.toLocaleString()} tokens
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => generateMutation.mutate()}
                  disabled={generating || !runId}
                  title={
                    hasContent
                      ? "Regenerate via Claude CLI"
                      : "Generate via Claude CLI"
                  }
                >
                  <RefreshCw
                    size={14}
                    className={generating ? "animate-spin" : ""}
                  />
                  {generating
                    ? "Generating..."
                    : hasContent
                      ? "Regenerate"
                      : "Generate"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saving || !hasContent}
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
                <CopyButton
                  text={draft}
                  label="Copy"
                  variant="secondary"
                  disabled={!hasContent}
                />
              </div>
            </div>
            <div className="card-body p-0">
              {hasContent || enrichQuery.isLoading ? (
                <textarea
                  className="textarea m-0 w-full rounded-none border-0 bg-transparent min-h-[28rem] focus:ring-0"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="Enriched research prompt will appear here..."
                  spellCheck={false}
                />
              ) : (
                <EmptyEnrichState
                  onGenerate={() => generateMutation.mutate()}
                  generating={generating}
                />
              )}
            </div>
          </div>

          {hasContent && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-300" />
                  Per-model copy
                </h3>
                <span className="text-[11px] text-slate-500">
                  All models receive the same prompt.
                </span>
              </div>
              <div className="card-body grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {SOURCE_NAMES.map((name) => (
                  <CopyButton
                    key={name}
                    text={draft}
                    label={SOURCE_NAME_LABELS[name]}
                    variant="ghost"
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold">
                02-model-run-instructions.md
              </h3>
              <CopyButton
                text={modelInstructions}
                label="Copy"
                variant="ghost"
                size="sm"
                disabled={!modelInstructions}
              />
            </div>
            <div className="card-body">
              {modelInstructions ? (
                <pre className="mono whitespace-pre-wrap text-[12px] text-slate-300 leading-relaxed max-h-[28rem] overflow-y-auto">
                  {modelInstructions}
                </pre>
              ) : (
                <p className="text-xs text-slate-500">
                  Generated alongside the enriched prompt.
                </p>
              )}
            </div>
          </div>

          {stage && stage.status === "complete" && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold">Stage metadata</h3>
              </div>
              <div className="card-body text-[12px] text-slate-400 space-y-1 mono">
                {stage.provider && <p>Provider: {stage.provider}</p>}
                {stage.model && <p>Model: {stage.model}</p>}
                {stage.durationMs != null && (
                  <p>Duration: {(stage.durationMs / 1000).toFixed(1)}s</p>
                )}
                {stage.command && (
                  <p className="break-all">
                    Command: {stage.command} {stage.args?.join(" ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-xs text-amber-300">Unsaved edits</span>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={!hasContent || dirty}
          onClick={() => navigate(`/runs/${runId}/collect`)}
        >
          Collect sources
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function EmptyEnrichState({
  onGenerate,
  generating,
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <Sparkles size={28} className="mx-auto text-indigo-300/70" />
      <h3 className="mt-3 text-sm font-medium text-slate-200">
        No enriched prompt yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-xs text-slate-400">
        Click <span className="text-slate-200">Generate</span> to run the
        prompt enricher (Claude CLI). The result is saved to
        <span className="mono"> 01-enriched-research-prompt.md</span> and can be
        edited inline before you copy it into the model UIs.
      </p>
      <button
        type="button"
        className={clsx("btn-primary mt-5 mx-auto")}
        disabled={generating}
        onClick={onGenerate}
      >
        <Sparkles size={14} />
        {generating ? "Generating..." : "Generate enriched prompt"}
      </button>
    </div>
  );
}

function StatusPill({
  stage,
  generating,
  dirty,
  empty,
}: {
  stage?: string;
  generating: boolean;
  dirty: boolean;
  empty: boolean;
}) {
  if (generating) return <span className="pill-info">● Generating</span>;
  if (dirty) return <span className="pill-warning">● Unsaved</span>;
  if (empty) return <span className="pill-neutral">○ Empty</span>;
  if (stage === "failed") return <span className="pill-danger">✕ Failed</span>;
  if (stage === "complete") return <span className="pill-success">✓ Saved</span>;
  return <span className="pill-neutral">— Pending</span>;
}
