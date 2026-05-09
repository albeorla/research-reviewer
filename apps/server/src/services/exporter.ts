import path from "node:path";
import os from "node:os";
import { createWriteStream, promises as fs } from "node:fs";
import archiver from "archiver";
import { execa } from "execa";
import { RunJson } from "@rcc/shared";
import { runStore } from "./runStore.js";
import { fileStore } from "./fileStore.js";
import { runPaths } from "../utils/paths.js";
import { badRequest, internal } from "../utils/errors.js";

const MD_EXPORT_NAME = "consolidated-decision.md";
const PDF_EXPORT_NAME = "consolidated-decision.pdf";
const ZIP_EXPORT_NAME = "full-run.zip";

export const exporter = {
  async exportMarkdown(runId: string): Promise<{
    run: RunJson;
    path: string;
    bytes: number;
  }> {
    const run = await runStore.get(runId);
    const finalPath = finalDecisionPath(run);
    if (!(await fileStore.exists(finalPath))) {
      throw badRequest(
        "Final decision artifact does not exist. Complete the review pipeline first.",
      );
    }
    const decisionMd = await fileStore.readText(finalPath);
    const out = path.join(runPaths.exportsDir(run.run.runDir), MD_EXPORT_NAME);
    const body = buildMarkdownExport(run, decisionMd);
    await fileStore.writeText(out, body);
    const stat = await fs.stat(out);
    const updated = await runStore.update(runId, (r) => ({
      ...r,
      exports: {
        ...r.exports,
        markdownPath: out,
        exportedAt: new Date().toISOString(),
      },
    }));
    return { run: updated, path: out, bytes: stat.size };
  },

  async exportZip(runId: string): Promise<{
    run: RunJson;
    path: string;
    bytes: number;
  }> {
    const run = await runStore.get(runId);
    const out = path.join(runPaths.exportsDir(run.run.runDir), ZIP_EXPORT_NAME);
    await fileStore.ensureDir(runPaths.exportsDir(run.run.runDir));
    await zipDirectory(run.run.runDir, out, [ZIP_EXPORT_NAME]);
    const stat = await fs.stat(out);
    const updated = await runStore.update(runId, (r) => ({
      ...r,
      exports: {
        ...r.exports,
        zipPath: out,
        exportedAt: new Date().toISOString(),
      },
    }));
    return { run: updated, path: out, bytes: stat.size };
  },

  async exportPdf(runId: string): Promise<{
    run: RunJson;
    path: string;
    bytes: number;
  }> {
    const playwright = await loadPlaywright();
    if (!playwright) {
      throw badRequest(
        "PDF export requires Playwright Chromium. Run `pnpm --filter @rcc/server exec playwright install chromium` and try again.",
      );
    }
    const run = await runStore.get(runId);
    const finalPath = finalDecisionPath(run);
    if (!(await fileStore.exists(finalPath))) {
      throw badRequest(
        "Final decision artifact does not exist. Complete the review pipeline first.",
      );
    }
    const decisionMd = await fileStore.readText(finalPath);
    const html = await renderHtml(run, decisionMd);
    const out = path.join(runPaths.exportsDir(run.run.runDir), PDF_EXPORT_NAME);
    await fileStore.ensureDir(runPaths.exportsDir(run.run.runDir));
    const browser = await playwright.chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      await page.pdf({
        path: out,
        format: "Letter",
        margin: { top: "0.6in", right: "0.6in", bottom: "0.6in", left: "0.6in" },
        printBackground: true,
      });
    } finally {
      await browser.close();
    }
    const stat = await fs.stat(out);
    const updated = await runStore.update(runId, (r) => ({
      ...r,
      exports: {
        ...r.exports,
        pdfPath: out,
        exportedAt: new Date().toISOString(),
      },
    }));
    return { run: updated, path: out, bytes: stat.size };
  },

  async openFolder(runId: string): Promise<{ run: RunJson; opened: string }> {
    const run = await runStore.get(runId);
    const target = run.run.runDir;
    const cmd = openCommand();
    if (!cmd) throw internal(`Unsupported platform: ${os.platform()}`);
    await execa(cmd.bin, [...cmd.args, target], { reject: false });
    return { run, opened: target };
  },
};

function finalDecisionPath(run: RunJson): string {
  return path.join(
    runPaths.decisionDir(run.run.runDir),
    "50-consolidated-decision.md",
  );
}

function buildMarkdownExport(run: RunJson, decisionMd: string): string {
  const lines: string[] = [];
  lines.push(`---`);
  lines.push(`title: ${run.inputs.topic}`);
  lines.push(`runId: ${run.run.id}`);
  lines.push(`date: ${run.run.date}`);
  lines.push(`decisionType: ${run.inputs.decisionType}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`---`);
  lines.push("");
  lines.push(decisionMd.trim());
  lines.push("");
  return lines.join("\n");
}

async function zipDirectory(
  sourceDir: string,
  outFile: string,
  excludeFiles: string[],
): Promise<void> {
  await fileStore.ensureDir(path.dirname(outFile));
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("warning", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") reject(err);
    });
    archive.on("error", reject);
    archive.pipe(output);
    archive.glob("**/*", {
      cwd: sourceDir,
      ignore: ["node_modules/**", ...excludeFiles.map((f) => `exports/${f}`)],
      dot: false,
    });
    void archive.finalize();
  });
}

interface PlaywrightModule {
  chromium: {
    launch: () => Promise<{
      newPage: () => Promise<{
        setContent: (html: string, opts: { waitUntil: string }) => Promise<void>;
        pdf: (opts: Record<string, unknown>) => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    // Indirection defeats TS's static module resolution so the server
    // type-checks even when 'playwright' isn't installed. PDF export is an
    // opt-in feature: install Chromium with `pnpm --filter @rcc/server exec
    // playwright install chromium` once you want it.
    const moduleName = "playwright";
    return (await import(moduleName)) as unknown as PlaywrightModule;
  } catch {
    return null;
  }
}

async function renderHtml(run: RunJson, decisionMd: string): Promise<string> {
  const { marked } = await import("marked");
  const body = await marked.parse(decisionMd);
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${escapeHtml(run.inputs.topic)} — Consolidated Decision</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif; line-height: 1.55; color: #1f2937; max-width: 7.5in; margin: 0 auto; padding: 0.4in 0; }
  h1 { font-size: 22px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 28px; }
  h3 { font-size: 14px; margin-top: 20px; }
  code, pre { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; font-size: 12.5px; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 3px solid #e5e7eb; margin: 8px 0; padding-left: 12px; color: #4b5563; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 12px; }
</style>
</head><body>
<div class="meta">${escapeHtml(run.run.id)} · ${escapeHtml(run.run.date)} · ${escapeHtml(run.inputs.decisionType)}</div>
${body}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openCommand(): { bin: string; args: string[] } | null {
  const platform = os.platform();
  if (platform === "darwin") return { bin: "open", args: [] };
  if (platform === "linux") return { bin: "xdg-open", args: [] };
  if (platform === "win32") return { bin: "cmd", args: ["/c", "start", ""] };
  return null;
}
