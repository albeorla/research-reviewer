import {
  RunJson,
  SaveSourceRequest,
  SourceName,
  SourceState,
  SourcesMap,
  SOURCE_NAMES,
} from "@rcc/shared";
import { fileStore } from "./fileStore.js";
import { runStore } from "./runStore.js";
import { runPaths } from "../utils/paths.js";
import { badRequest } from "../utils/errors.js";
import { metricsFor, validateSource } from "./sourceValidator.js";

export interface SaveSourceResult {
  run: RunJson;
  sourceState: SourceState;
  content: string;
}

export interface SourceContent {
  state: SourceState;
  content: string | null;
}

export const sourceStore = {
  async save(
    runId: string,
    name: SourceName,
    body: SaveSourceRequest,
  ): Promise<SaveSourceResult> {
    const run = await runStore.get(runId);
    let content: string;
    let displayPath: string;

    if (body.mode === "paste") {
      content = body.content ?? "";
      const sourcePath = runPaths.source(run.run.runDir, name);
      await fileStore.writeText(sourcePath, content);
      displayPath = sourcePath;
    } else {
      if (!body.filePath) {
        throw badRequest("File path required for file mode");
      }
      if (!(await fileStore.exists(body.filePath))) {
        throw badRequest(`File not found: ${body.filePath}`);
      }
      content = await fileStore.readText(body.filePath);
      // Mirror into the run's sources/ dir for portability and so exports work.
      const sourcePath = runPaths.source(run.run.runDir, name);
      await fileStore.writeText(sourcePath, content);
      displayPath = body.filePath;
    }

    const others = await loadOtherSources(run, name);
    const validation = validateSource({ name, content, others });
    const metrics = metricsFor(content);

    const state: SourceState = {
      mode: body.mode,
      path: displayPath,
      wordCount: metrics.wordCount,
      approxTokenCount: metrics.approxTokenCount,
      savedAt: new Date().toISOString(),
      validation,
      enabled: run.inputs.sources[name]?.enabled !== false,
    };

    const updated = await runStore.update(runId, (r) => {
      // Re-validate every saved source against the new full set to keep
      // dup-detection consistent.
      const provisional: SourcesMap = {
        ...r.inputs.sources,
        [name]: state,
      };
      const all: Array<{ name: SourceName; content: string }> = [];
      // We need actual contents for revalidation; load lazily next.
      return {
        ...r,
        inputs: { ...r.inputs, sources: provisional },
      };
    });

    // Now revalidate all the others (not just the just-saved one) using disk
    // contents. This catches the case where saving X turns Y into a duplicate.
    const finalRun = await revalidateAllSources(updated.run.id);
    const finalState = finalRun.inputs.sources[name];

    return { run: finalRun, sourceState: finalState, content };
  },

  async setEnabled(
    runId: string,
    name: SourceName,
    enabled: boolean,
  ): Promise<{ run: RunJson; sources: Record<SourceName, SourceContent> }> {
    await runStore.update(runId, (r) => {
      // Changing the active provider set invalidates a completed source audit
      // (it examined a different set), so reset it to pending. The review
      // pipeline is gated on a complete audit, which forces a re-run.
      const stages = { ...r.pipeline.stages };
      if (stages.source_audit && stages.source_audit.status !== "pending") {
        stages.source_audit = { status: "pending" };
      }
      return {
        ...r,
        inputs: {
          ...r.inputs,
          sources: {
            ...r.inputs.sources,
            [name]: { ...r.inputs.sources[name]!, enabled },
          },
        },
        pipeline: { ...r.pipeline, stages },
      };
    });
    // Re-run duplicate detection so excluding/including a provider updates the
    // warnings on the remaining active sources.
    await revalidateAllSources(runId);
    return this.list(runId);
  },

  async list(runId: string): Promise<{
    run: RunJson;
    sources: Record<SourceName, SourceContent>;
  }> {
    const run = await runStore.get(runId);
    const out = {} as Record<SourceName, SourceContent>;
    for (const name of SOURCE_NAMES) {
      const state = run.inputs.sources[name];
      const sourcePath = runPaths.source(run.run.runDir, name);
      const content = (await fileStore.exists(sourcePath))
        ? await fileStore.readText(sourcePath)
        : null;
      out[name] = { state, content };
    }
    return { run, sources: out };
  },
};

async function loadOtherSources(
  run: RunJson,
  excluding: SourceName,
): Promise<Array<{ name: SourceName; content: string }>> {
  const out: Array<{ name: SourceName; content: string }> = [];
  for (const name of SOURCE_NAMES) {
    if (name === excluding) continue;
    const state = run.inputs.sources[name];
    if (!state.savedAt || state.enabled === false) continue;
    const sourcePath = runPaths.source(run.run.runDir, name);
    if (!(await fileStore.exists(sourcePath))) continue;
    out.push({
      name,
      content: await fileStore.readText(sourcePath),
    });
  }
  return out;
}

async function revalidateAllSources(runId: string): Promise<RunJson> {
  const run = await runStore.get(runId);
  // Build the universe of saved-source contents.
  const universe = new Map<SourceName, string>();
  for (const name of SOURCE_NAMES) {
    const state = run.inputs.sources[name];
    if (!state.savedAt || state.enabled === false) continue;
    const sourcePath = runPaths.source(run.run.runDir, name);
    if (!(await fileStore.exists(sourcePath))) continue;
    universe.set(name, await fileStore.readText(sourcePath));
  }

  return runStore.update(runId, (r) => {
    const next: SourcesMap = { ...r.inputs.sources };
    for (const [name, content] of universe) {
      const others = [...universe.entries()]
        .filter(([n]) => n !== name)
        .map(([n, c]) => ({ name: n, content: c }));
      const validation = validateSource({ name, content, others });
      next[name] = { ...next[name]!, validation };
    }
    return { ...r, inputs: { ...r.inputs, sources: next } };
  });
}
