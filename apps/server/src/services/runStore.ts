import path from "node:path";
import {
  CreateRunRequest,
  RunJson,
  RunSummary,
  SourcesMap,
  SourceState,
  SOURCE_NAMES,
  PIPELINE_STAGES,
  StageState,
  normalizeSlug,
  runFolderName,
} from "@rcc/shared";
import { config } from "../config.js";
import { resolveOutputRoot, runPaths } from "../utils/paths.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { fileStore } from "./fileStore.js";
import { runRegistry } from "./runRegistry.js";

interface RunEntry {
  id: string;
  runDir: string;
  outputRoot: string;
}

class RunStore {
  // id -> { runDir, outputRoot } map for in-process lookup.
  private readonly index = new Map<string, RunEntry>();
  // Per-run write mutex so concurrent stage updates don't race.
  private readonly locks = new Map<string, Promise<unknown>>();
  private hydrated = false;

  /**
   * On first use, scan (a) the default output root and (b) every output root
   * recorded in the persistent registry — so runs created against ad-hoc
   * locations survive server restarts.
   */
  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;

    const roots = new Set<string>();
    roots.add(resolveOutputRoot(config.defaultOutputRoot));

    const registered = await runRegistry.load();
    for (const entry of registered) roots.add(entry.outputRoot);

    for (const root of roots) {
      if (!(await fileStore.exists(root))) continue;
      const entries = await fileStore.listDir(root);
      for (const name of entries) {
        const runDir = path.join(root, name);
        const runJsonPath = runPaths.runJson(runDir);
        if (!(await fileStore.exists(runJsonPath))) continue;
        try {
          const data = await fileStore.readJson<RunJson>(runJsonPath);
          if (data.run?.id) {
            this.index.set(data.run.id, {
              id: data.run.id,
              runDir,
              outputRoot: root,
            });
          }
        } catch {
          // Skip malformed run.json files.
        }
      }
    }
  }

  async create(input: CreateRunRequest): Promise<RunJson> {
    const slug = normalizeSlug(input.topic);
    if (!slug) {
      throw badRequest(
        "Topic could not be normalized to a valid slug. Use letters, numbers, or hyphens.",
      );
    }

    const outputRoot = resolveOutputRoot(input.outputRoot);
    if (!(await fileStore.isWritable(outputRoot))) {
      throw badRequest(
        `Output root is not writable: ${outputRoot}. Choose another path.`,
      );
    }

    await this.hydrate();

    // Find a non-colliding run directory name.
    const baseName = runFolderName(slug, input.date);
    let runDirName = baseName;
    let suffix = 2;
    while (await fileStore.exists(path.join(outputRoot, runDirName))) {
      runDirName = `${baseName}-${suffix}`;
      suffix += 1;
      if (suffix > 99) {
        throw conflict(
          "Too many runs with the same topic and date already exist.",
        );
      }
    }
    const runDir = path.join(outputRoot, runDirName);
    const id = runDirName; // ID == folder name for human-readable URLs.

    const now = new Date().toISOString();

    // Initialize empty source slots.
    const initialSource = (): SourceState => ({
      mode: "paste",
      path: "",
      wordCount: 0,
      approxTokenCount: 0,
      savedAt: null,
      validation: {
        status: "error",
        warnings: ["No source saved yet"],
      },
      enabled: true,
    });
    const sources: SourcesMap = {
      chatgpt: initialSource(),
      claude: initialSource(),
      gemini: initialSource(),
      deepseek: initialSource(),
      kimi: initialSource(),
    };

    // Initialize all pipeline stages as pending.
    const stages: Record<string, StageState> = {};
    for (const stage of PIPELINE_STAGES) {
      stages[stage] = { status: "pending" };
    }

    const runJson: RunJson = {
      schemaVersion: 1,
      run: {
        id,
        slug,
        date: input.date,
        createdAt: now,
        updatedAt: now,
        outputRoot,
        runDir,
        mode: input.mode ?? "standard",
      },
      inputs: {
        topic: input.topic,
        decisionType: input.decisionType,
        constraints: input.constraints ?? "",
        budgetCap: input.budgetCap ?? "",
        originalIdeaPath: runPaths.originalIdea(runDir),
        enrichedPromptPath: runPaths.enrichedPrompt(runDir),
        modelInstructionsPath: runPaths.modelInstructions(runDir),
        skipEnrichment: false,
        sources,
      },
      pipeline: { stages },
      exports: {},
    };

    // Create folder layout.
    await fileStore.ensureDir(runDir);
    await fileStore.ensureDir(runPaths.sourcesDir(runDir));
    await fileStore.ensureDir(runPaths.reviewDir(runDir));
    await fileStore.ensureDir(runPaths.decisionDir(runDir));
    await fileStore.ensureDir(runPaths.exportsDir(runDir));

    // Write the original idea and the run.json + a small README inside the run folder.
    await fileStore.writeText(
      runPaths.originalIdea(runDir),
      buildOriginalIdeaMarkdown(input),
    );
    await fileStore.writeText(runPaths.readme(runDir), buildRunReadme(runJson));
    await fileStore.writeJson(runPaths.runJson(runDir), runJson);

    this.index.set(id, { id, runDir, outputRoot });
    await runRegistry.add({ id, runDir, outputRoot });
    return runJson;
  }

  async get(id: string): Promise<RunJson> {
    await this.hydrate();
    const entry = this.index.get(id);
    if (!entry) {
      throw notFound(`Run not found: ${id}`);
    }
    return fileStore.readJson<RunJson>(runPaths.runJson(entry.runDir));
  }

  async update(id: string, mutator: (run: RunJson) => RunJson): Promise<RunJson> {
    // Serialize updates per-run so parallel pipeline stages don't lose writes.
    const prev = this.locks.get(id) ?? Promise.resolve();
    const next = prev.then(() => this.doUpdate(id, mutator));
    // Always replace the lock; swallow errors so a failed update doesn't
    // poison the queue for subsequent updates.
    this.locks.set(
      id,
      next.catch(() => undefined),
    );
    return next;
  }

  private async doUpdate(
    id: string,
    mutator: (run: RunJson) => RunJson,
  ): Promise<RunJson> {
    const current = await this.get(id);
    const next = mutator(current);
    next.run.updatedAt = new Date().toISOString();
    const entry = this.index.get(id);
    if (!entry) {
      throw notFound(`Run not found: ${id}`);
    }
    await fileStore.writeJson(runPaths.runJson(entry.runDir), next);
    return next;
  }

  async list(limit = 20): Promise<RunSummary[]> {
    await this.hydrate();
    const summaries: RunSummary[] = [];
    for (const entry of this.index.values()) {
      try {
        const run = await fileStore.readJson<RunJson>(
          runPaths.runJson(entry.runDir),
        );
        summaries.push({
          id: run.run.id,
          slug: run.run.slug,
          date: run.run.date,
          topic: run.inputs.topic,
          decisionType: run.inputs.decisionType,
          runDir: run.run.runDir,
          createdAt: run.run.createdAt,
          updatedAt: run.run.updatedAt,
        });
      } catch {
        // Skip unreadable runs.
      }
    }
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries.slice(0, limit);
  }
}

function buildOriginalIdeaMarkdown(input: CreateRunRequest): string {
  const lines: string[] = [];
  lines.push(`# Original Idea`);
  lines.push("");
  lines.push(`- Topic: ${input.topic}`);
  lines.push(`- Date: ${input.date}`);
  lines.push(`- Decision type: ${input.decisionType}`);
  if (input.constraints?.trim()) {
    lines.push(`- Constraints: ${input.constraints.trim()}`);
  }
  if (input.budgetCap?.trim()) {
    lines.push(`- Budget cap: ${input.budgetCap.trim()}`);
  }
  lines.push("");
  lines.push(`## Idea`);
  lines.push("");
  lines.push(input.originalIdea.trim());
  lines.push("");
  return lines.join("\n");
}

function buildRunReadme(run: RunJson): string {
  return [
    `# ${run.inputs.topic}`,
    "",
    `Run ID: ${run.run.id}`,
    `Date: ${run.run.date}`,
    `Decision type: ${run.inputs.decisionType}`,
    `Run directory: ${run.run.runDir}`,
    "",
    `## Layout`,
    "",
    "- 00-original-idea.md",
    "- 01-enriched-research-prompt.md (Phase 2)",
    "- 02-model-run-instructions.md (Phase 2)",
    "- sources/<model>-research.md (Phase 3)",
    "- review/ (Phase 4)",
    "- decision/ (Phase 4-5)",
    "- exports/ (Phase 5)",
    "- run.json (machine-readable run state)",
    "",
  ].join("\n");
}

export const runStore = new RunStore();
