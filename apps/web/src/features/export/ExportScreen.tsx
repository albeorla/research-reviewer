import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExportResponse,
  exportApi,
} from "@/lib/apiExport";
import { api } from "@/lib/api";
import {
  Archive,
  ExternalLink,
  FileText,
  FolderOpen,
  Printer,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

interface CardSpec {
  id: "markdown" | "pdf" | "zip" | "folder";
  title: string;
  desc: string;
  icon: typeof FileText;
  outputHint: string;
}

const CARDS: CardSpec[] = [
  {
    id: "markdown",
    title: "Markdown",
    desc: "Clean copy of the final consolidated decision with metadata header.",
    icon: FileText,
    outputHint: "exports/consolidated-decision.md",
  },
  {
    id: "pdf",
    title: "PDF",
    desc: "Rendered final decision via Playwright Chromium. Requires `playwright install chromium` once.",
    icon: Printer,
    outputHint: "exports/consolidated-decision.pdf",
  },
  {
    id: "zip",
    title: "Full ZIP",
    desc: "Complete run package: prompts, sources, review, decision, run.json.",
    icon: Archive,
    outputHint: "exports/full-run.zip",
  },
  {
    id: "folder",
    title: "Folder",
    desc: "Open the run directory in the local file browser.",
    icon: FolderOpen,
    outputHint: "(opens in Finder / Explorer)",
  },
];

export function ExportScreen() {
  const { runId } = useParams<{ runId: string }>();
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => (runId ? api.getRun(runId) : Promise.reject("no run")),
    enabled: Boolean(runId),
  });

  const [results, setResults] = useState<
    Partial<Record<CardSpec["id"], { ok: boolean; message: string }>>
  >({});

  function trackResult(id: CardSpec["id"], result: { ok: boolean; message: string }) {
    setResults((p) => ({ ...p, [id]: result }));
  }

  const mdMut = useMutation<ExportResponse>({
    mutationFn: () => exportApi.markdown(runId!),
    onSuccess: (d) => {
      trackResult("markdown", {
        ok: true,
        message: `Wrote ${d.path} (${formatBytes(d.bytes)})`,
      });
      queryClient.setQueryData(["run", runId], d.run);
    },
    onError: (e) => trackResult("markdown", { ok: false, message: errMsg(e) }),
  });
  const pdfMut = useMutation<ExportResponse>({
    mutationFn: () => exportApi.pdf(runId!),
    onSuccess: (d) => {
      trackResult("pdf", {
        ok: true,
        message: `Wrote ${d.path} (${formatBytes(d.bytes)})`,
      });
      queryClient.setQueryData(["run", runId], d.run);
    },
    onError: (e) => trackResult("pdf", { ok: false, message: errMsg(e) }),
  });
  const zipMut = useMutation<ExportResponse>({
    mutationFn: () => exportApi.zip(runId!),
    onSuccess: (d) => {
      trackResult("zip", {
        ok: true,
        message: `Wrote ${d.path} (${formatBytes(d.bytes)})`,
      });
      queryClient.setQueryData(["run", runId], d.run);
    },
    onError: (e) => trackResult("zip", { ok: false, message: errMsg(e) }),
  });
  const folderMut = useMutation({
    mutationFn: () => exportApi.openFolder(runId!),
    onSuccess: (d) =>
      trackResult("folder", { ok: true, message: `Opened ${d.opened}` }),
    onError: (e) => trackResult("folder", { ok: false, message: errMsg(e) }),
  });

  const handlers: Record<CardSpec["id"], () => void> = {
    markdown: () => mdMut.mutate(),
    pdf: () => pdfMut.mutate(),
    zip: () => zipMut.mutate(),
    folder: () => folderMut.mutate(),
  };
  const pending: Record<CardSpec["id"], boolean> = {
    markdown: mdMut.isPending,
    pdf: pdfMut.isPending,
    zip: zipMut.isPending,
    folder: folderMut.isPending,
  };

  const finalReady =
    runQuery.data?.pipeline.stages.final_decision?.status === "complete";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">⑥ Export</h1>
        <p className="mt-1 text-sm text-slate-400">
          Export the final decision or package the complete run.
        </p>
      </header>

      {!finalReady && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="card-body text-sm text-amber-200">
            Final decision is not complete. Markdown and PDF exports require
            it; ZIP and Folder will work but are less useful.
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          const result = results[c.id];
          const isPending = pending[c.id];
          const requiresFinal = c.id === "markdown" || c.id === "pdf";
          return (
            <div key={c.id} className="card">
              <div className="card-header">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Icon size={14} className="text-indigo-300" />
                  {c.title}
                </h2>
              </div>
              <div className="card-body space-y-3">
                <p className="text-sm text-slate-300">{c.desc}</p>
                <p className="mono text-[11px] text-slate-500">
                  {c.outputHint}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isPending || (requiresFinal && !finalReady)}
                    onClick={handlers[c.id]}
                  >
                    {c.id === "folder" ? (
                      <ExternalLink size={14} />
                    ) : (
                      <Icon size={14} />
                    )}
                    {isPending
                      ? "Working..."
                      : c.id === "folder"
                        ? "Open folder"
                        : `Export ${c.title.toLowerCase()}`}
                  </button>
                  {result && (
                    <span
                      className={clsx(
                        "text-[11px] mono",
                        result.ok ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {result.ok ? "✓" : "✕"} {result.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {runQuery.data?.exports && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold">Latest exports</h2>
            {runQuery.data.exports.exportedAt && (
              <span className="text-[11px] text-slate-500 mono">
                {new Date(runQuery.data.exports.exportedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="card-body text-[12px] text-slate-300 space-y-1 mono">
            <ExportLine label="Markdown" path={runQuery.data.exports.markdownPath} />
            <ExportLine label="PDF" path={runQuery.data.exports.pdfPath} />
            <ExportLine label="ZIP" path={runQuery.data.exports.zipPath} />
          </div>
        </div>
      )}
    </div>
  );
}

function ExportLine({ label, path }: { label: string; path?: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}:</span>{" "}
      {path ? <span className="text-slate-200 break-all">{path}</span> : <span className="text-slate-600">(not exported)</span>}
    </p>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
