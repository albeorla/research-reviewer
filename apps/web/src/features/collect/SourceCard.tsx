import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approxTokenCount,
  SourceName,
  SOURCE_NAME_LABELS,
  SOURCE_OPEN_URLS,
  SourceState,
  wordCount,
} from "@rcc/shared";
import { sourcesApi } from "@/lib/apiSources";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Circle,
  ExternalLink,
  EyeOff,
  Save,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  runId: string;
  name: SourceName;
  state: SourceState;
  serverContent: string | null;
  /** Effective research prompt to copy (enriched prompt, or raw idea if skipped). */
  prompt: string;
  onExclude: () => void;
  excluding?: boolean;
}

export function SourceCard({
  runId,
  name,
  state,
  serverContent,
  prompt,
  onExclude,
  excluding,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"paste" | "file">(state.mode ?? "paste");
  const [pasteDraft, setPasteDraft] = useState(serverContent ?? "");
  const [filePath, setFilePath] = useState(
    state.mode === "file" ? state.path : "",
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-hydrate on serverContent change (after a save returns updated state)
  useEffect(() => {
    if (!dirty) {
      setPasteDraft(serverContent ?? "");
      if (state.mode === "file") setFilePath(state.path);
    }
  }, [serverContent, state.mode, state.path, dirty]);

  const wc = mode === "paste" ? wordCount(pasteDraft) : state.wordCount;
  const tk = mode === "paste" ? approxTokenCount(pasteDraft) : state.approxTokenCount;

  const saveMutation = useMutation({
    mutationFn: () =>
      sourcesApi.save(runId, name, {
        mode,
        content: mode === "paste" ? pasteDraft : undefined,
        filePath: mode === "file" ? filePath : undefined,
      }),
    onSuccess: (data) => {
      setError(null);
      setDirty(false);
      qc.setQueryData(["sources", runId], (prev: any) =>
        prev
          ? {
              ...prev,
              run: data.run,
              sources: {
                ...prev.sources,
                [name]: { state: data.sourceState, content: data.content },
              },
            }
          : prev,
      );
      qc.setQueryData(["run", runId], data.run);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
  });

  const validation = state.validation;
  const status = computeStatus(state, dirty, !!serverContent);

  return (
    <div
      className={clsx(
        "card transition-colors",
        status === "error" && "border-red-500/30",
        status === "warning" && "border-amber-500/30",
        status === "valid" && "border-emerald-500/30",
      )}
    >
      <div className="card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{SOURCE_NAME_LABELS[name]}</h3>
          <StatusPill status={status} />
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={SOURCE_OPEN_URLS[name]}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-xs"
          >
            <ExternalLink size={12} />
            Open
          </a>
          <CopyButton
            text={prompt}
            label="Copy prompt"
            variant="ghost"
            size="sm"
            disabled={!prompt}
          />
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={onExclude}
            disabled={excluding}
            title="Exclude this provider from this run"
          >
            <EyeOff size={12} />
            Exclude
          </button>
        </div>
      </div>
      <div className="card-body space-y-3">
        <div className="flex items-center gap-4">
          <ModeToggle mode={mode} onChange={(m) => { setMode(m); setDirty(true); }} />
          <div className="text-[11px] text-slate-500 mono ml-auto">
            {wc.toLocaleString()} words · ~{tk.toLocaleString()} tokens
          </div>
        </div>
        {mode === "paste" ? (
          <textarea
            className="textarea min-h-[10rem]"
            value={pasteDraft}
            onChange={(e) => {
              setPasteDraft(e.target.value);
              setDirty(true);
            }}
            placeholder={`Paste the full ${SOURCE_NAME_LABELS[name]} response here...`}
            spellCheck={false}
          />
        ) : (
          <input
            className="input mono text-[13px]"
            type="text"
            value={filePath}
            onChange={(e) => {
              setFilePath(e.target.value);
              setDirty(true);
            }}
            placeholder="/absolute/path/to/response.md"
          />
        )}

        {(validation.warnings.length > 0 || error) && (
          <ul className="space-y-1 text-xs">
            {validation.warnings.map((w, i) => (
              <li
                key={i}
                className={clsx(
                  "flex items-start gap-1.5",
                  validation.status === "error"
                    ? "text-red-300"
                    : "text-amber-300",
                )}
              >
                {validation.status === "error" ? (
                  <AlertCircle size={12} className="mt-[2px] shrink-0" />
                ) : (
                  <AlertTriangle size={12} className="mt-[2px] shrink-0" />
                )}
                <span>{w}</span>
              </li>
            ))}
            {error && (
              <li className="flex items-start gap-1.5 text-red-300">
                <AlertCircle size={12} className="mt-[2px] shrink-0" />
                <span>{error}</span>
              </li>
            )}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="text-[11px] text-slate-500 mono">
            {state.savedAt
              ? `Saved ${new Date(state.savedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Not saved"}
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={!dirty || saveMutation.isPending || !canSave(mode, pasteDraft, filePath)}
            onClick={() => saveMutation.mutate()}
          >
            <Save size={14} />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "paste" | "file";
  onChange: (m: "paste" | "file") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-700 p-0.5 text-xs">
      {(["paste", "file"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={clsx(
            "px-2.5 py-0.5 rounded",
            mode === m
              ? "bg-slate-700 text-slate-100"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {m === "paste" ? "Paste" : "File path"}
        </button>
      ))}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "empty" | "draft" | "valid" | "warning" | "error";
}) {
  if (status === "empty")
    return (
      <span className="pill-neutral">
        <Circle size={10} /> Empty
      </span>
    );
  if (status === "draft")
    return <span className="pill-warning">● Unsaved</span>;
  if (status === "valid")
    return (
      <span className="pill-success">
        <Check size={10} /> Valid
      </span>
    );
  if (status === "warning")
    return <span className="pill-warning">⚠ Warning</span>;
  return <span className="pill-danger">✕ Error</span>;
}

function computeStatus(
  state: SourceState,
  dirty: boolean,
  hasServerContent: boolean,
): "empty" | "draft" | "valid" | "warning" | "error" {
  if (dirty) return "draft";
  if (!hasServerContent && !state.savedAt) return "empty";
  return state.validation.status as "valid" | "warning" | "error";
}

function canSave(
  mode: "paste" | "file",
  paste: string,
  filePath: string,
): boolean {
  if (mode === "paste") return paste.trim().length > 0;
  return filePath.trim().length > 0;
}
