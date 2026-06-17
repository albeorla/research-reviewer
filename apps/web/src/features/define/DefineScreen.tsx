import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  CreateRunRequest,
  DECISION_TYPES,
  DECISION_TYPE_LABELS,
  type DecisionType,
  normalizeSlug,
  runFolderName,
  todayISODate,
} from "@rcc/shared";
import { ApiError, api } from "@/lib/api";
import { ChevronRight, FolderTree, Sparkles } from "lucide-react";
import clsx from "clsx";

interface DraftState {
  topic: string;
  date: string;
  outputRoot: string;
  decisionType: DecisionType;
  originalIdea: string;
  constraints: string;
  budgetCap: string;
}

export function DefineScreen() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEditMode = Boolean(runId);
  const existingRunQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => (runId ? api.getRun(runId) : Promise.resolve(null)),
    enabled: isEditMode,
  });
  const existing = existingRunQuery.data ?? null;

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    enabled: !isEditMode,
  });

  const [draft, setDraft] = useState<DraftState>(() => ({
    topic: "",
    date: todayISODate(),
    outputRoot: "",
    decisionType: "technical_architecture",
    originalIdea: "",
    constraints: "",
    budgetCap: "",
  }));

  // Hydrate the form's output root once health data arrives.
  const initialOutputRoot = healthQuery.data?.defaultOutputRoot ?? "";
  useEffect(() => {
    if (!isEditMode && initialOutputRoot) {
      setDraft((d) => (d.outputRoot ? d : { ...d, outputRoot: initialOutputRoot }));
    }
  }, [isEditMode, initialOutputRoot]);

  const slugPreview = useMemo(() => normalizeSlug(draft.topic), [draft.topic]);
  const folderPreview = slugPreview
    ? runFolderName(slugPreview, draft.date)
    : "";

  const validation = useMemo(() => validateDraft(draft, slugPreview), [
    draft,
    slugPreview,
  ]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: CreateRunRequest = CreateRunRequest.parse({
        topic: draft.topic,
        date: draft.date,
        outputRoot: draft.outputRoot,
        decisionType: draft.decisionType,
        originalIdea: draft.originalIdea,
        constraints: draft.constraints,
        budgetCap: draft.budgetCap,
      });
      return api.createRun(body);
    },
    onSuccess: (run) => {
      queryClient.setQueryData(["run", run.run.id], run);
      navigate(`/runs/${run.run.id}/enrich`);
    },
  });

  const submitting = createMutation.isPending;
  const canSubmit = validation.isValid && !submitting && !isEditMode;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">① Define Research Run</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create a local research run folder and capture the rough idea.
        </p>
      </header>

      {isEditMode && existing && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="card-body text-sm text-amber-200">
            Viewing an existing run. Editing the original idea is not yet
            supported in Phase 1; advance to{" "}
            <button
              type="button"
              className="underline"
              onClick={() => navigate(`/runs/${existing.run.id}/enrich`)}
            >
              Enrich
            </button>
            .
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold">Run setup</h2>
              <span className="text-[11px] text-slate-500">
                Required to create a run folder
              </span>
            </div>
            <div className="card-body space-y-5">
              <Field
                label="Topic / slug"
                hint={
                  draft.topic && draft.topic.toLowerCase() !== slugPreview ? (
                    <>
                      Slug will be normalized to{" "}
                      <code className="mono text-amber-300">
                        {slugPreview || "—"}
                      </code>
                    </>
                  ) : draft.topic ? (
                    <>
                      Slug:{" "}
                      <code className="mono text-emerald-300">{slugPreview}</code>
                    </>
                  ) : (
                    "Used for the run folder name and ID."
                  )
                }
                error={validation.errors.topic}
              >
                <input
                  className="input"
                  type="text"
                  value={draft.topic}
                  onChange={(e) =>
                    setDraft({ ...draft, topic: e.target.value })
                  }
                  placeholder="e.g. local research consolidation console"
                  disabled={isEditMode}
                />
              </Field>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Date"
                  hint="Defaults to today; included in the run folder name."
                  error={validation.errors.date}
                >
                  <input
                    className="input"
                    type="date"
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                    disabled={isEditMode}
                  />
                </Field>

                <Field
                  label="Decision type"
                  hint="Affects the prompt enricher template."
                  error={validation.errors.decisionType}
                >
                  <select
                    className="select"
                    value={draft.decisionType}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        decisionType: e.target.value as DecisionType,
                      })
                    }
                    disabled={isEditMode}
                  >
                    {DECISION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {DECISION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field
                label="Output root"
                hint="Absolute path. Each run gets its own folder underneath."
                error={validation.errors.outputRoot}
              >
                <input
                  className="input mono text-[13px]"
                  type="text"
                  value={draft.outputRoot}
                  onChange={(e) =>
                    setDraft({ ...draft, outputRoot: e.target.value })
                  }
                  placeholder="/Users/you/research-runs"
                  disabled={isEditMode}
                />
              </Field>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold">Original idea</h2>
              <span className="text-[11px] text-slate-500">
                Saved as 00-original-idea.md
              </span>
            </div>
            <div className="card-body space-y-5">
              <Field
                label="Idea (rough is fine)"
                hint="The next step turns this into a rigorous prompt."
                error={validation.errors.originalIdea}
              >
                <textarea
                  className="textarea min-h-[10rem]"
                  value={draft.originalIdea}
                  onChange={(e) =>
                    setDraft({ ...draft, originalIdea: e.target.value })
                  }
                  placeholder="Describe what you want to research, what decision you're trying to make, what context matters."
                  disabled={isEditMode}
                />
              </Field>

              <Field
                label="Optional constraints"
                hint="Budget caps, hard requirements, no-go territory, deadlines."
              >
                <textarea
                  className="textarea min-h-[5rem]"
                  value={draft.constraints}
                  onChange={(e) =>
                    setDraft({ ...draft, constraints: e.target.value })
                  }
                  placeholder="Local only, must work offline, no third-party SaaS, etc."
                  disabled={isEditMode}
                />
              </Field>

              <Field
                label="Optional budget cap"
                hint="Tokens, dollars, or wall-time. Leave blank if unbounded."
              >
                <input
                  className="input"
                  type="text"
                  value={draft.budgetCap}
                  onChange={(e) =>
                    setDraft({ ...draft, budgetCap: e.target.value })
                  }
                  placeholder="e.g. ~200k tokens / $5 / 30 min"
                  disabled={isEditMode}
                />
              </Field>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-300" />
                What happens next
              </h2>
            </div>
            <div className="card-body">
              <ol className="space-y-2 text-sm text-slate-300">
                <Step n={1}>Save your idea as 00-original-idea.md.</Step>
                <Step n={2}>Create the run folder layout on disk.</Step>
                <Step n={3}>
                  Generate an enriched research prompt (or skip it) to run
                  across your models.
                </Step>
                <Step n={4}>
                  Paste each model's output back and start the review pipeline.
                </Step>
              </ol>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FolderTree size={14} className="text-indigo-300" />
                Output folder preview
              </h2>
            </div>
            <div className="card-body">
              <p className="mono text-[12px] text-slate-300 break-all">
                {draft.outputRoot || "<output root>"}/
                <span
                  className={clsx(
                    folderPreview ? "text-emerald-300" : "text-slate-500",
                  )}
                >
                  {folderPreview || "<slug>-<date>"}
                </span>
                /
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Decision type: {DECISION_TYPE_LABELS[draft.decisionType]}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {createMutation.isError && (
        <div className="card border-red-500/30 bg-red-500/5">
          <div className="card-body text-sm text-red-300">
            <p className="font-medium">Could not create run.</p>
            <p className="mt-1">{describeError(createMutation.error)}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {!validation.isValid && (
          <p className="text-xs text-amber-300">
            {Object.values(validation.errors).filter(Boolean)[0]}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={!canSubmit}
          onClick={() => createMutation.mutate()}
        >
          {submitting ? "Creating run..." : "Create run"}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-300">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mono text-[11px] text-indigo-300 mt-0.5">{n}.</span>
      <span>{children}</span>
    </li>
  );
}

interface ValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof DraftState, string>>;
}

function validateDraft(d: DraftState, slug: string): ValidationResult {
  const errors: Partial<Record<keyof DraftState, string>> = {};
  if (!d.topic.trim()) errors.topic = "Topic is required";
  else if (!slug) errors.topic = "Topic must include letters or numbers";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date))
    errors.date = "Date must be YYYY-MM-DD";
  if (!d.outputRoot.trim()) errors.outputRoot = "Output root is required";
  if (!d.originalIdea.trim()) errors.originalIdea = "Original idea is required";
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.details && typeof err.details === "object") {
      try {
        return `${err.message} — ${JSON.stringify(err.details)}`;
      } catch {
        return err.message;
      }
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}
