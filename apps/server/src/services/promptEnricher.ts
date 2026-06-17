import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CliProvider,
  DECISION_TYPE_LABELS,
  RunJson,
  StageState,
} from "@rcc/shared";
import { fileStore } from "./fileStore.js";
import { runStore } from "./runStore.js";
import { runPaths } from "../utils/paths.js";
import { cliRunner } from "./cliRunner.js";
import { internal } from "../utils/errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src/services -> ../../../prompts
const PROMPTS_DIR = path.resolve(__dirname, "../../../../prompts");
const ENRICHER_TEMPLATE = path.join(PROMPTS_DIR, "enricher.md");
const MODEL_INSTRUCTIONS_TEMPLATE = path.join(
  PROMPTS_DIR,
  "model-run-instructions.md",
);

export interface EnrichOptions {
  runId: string;
  /** When provided, write this content directly without invoking the CLI. */
  manualPrompt?: string;
  /** Override default CLI provider (Claude). */
  provider?: CliProvider;
  /** Override model. Defaults to Claude's "sonnet" alias. */
  model?: string;
}

export interface EnrichResult {
  enrichedPrompt: string;
  modelInstructions: string;
  stage: StageState;
  run: RunJson;
}

export const promptEnricher = {
  async enrich(opts: EnrichOptions): Promise<EnrichResult> {
    const run = await runStore.get(opts.runId);
    const enrichedPath = runPaths.enrichedPrompt(run.run.runDir);
    const instructionsPath = runPaths.modelInstructions(run.run.runDir);

    let stage: StageState;
    let enrichedPrompt: string;

    if (opts.manualPrompt !== undefined) {
      enrichedPrompt = opts.manualPrompt;
      await fileStore.writeText(enrichedPath, enrichedPrompt);
      stage = {
        status: "complete",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        outputPath: enrichedPath,
        provider: undefined,
        command: "manual",
        args: [],
      };
    } else {
      const provider: CliProvider = opts.provider ?? "claude";
      const model = opts.model ?? (provider === "claude" ? "sonnet" : "gpt-5");
      const prompt = await buildEnricherPrompt(run);
      const startedAt = new Date().toISOString();
      const result = await cliRunner.invoke({
        provider,
        prompt,
        outputFile: enrichedPath,
        model,
        timeoutMs: 5 * 60_000,
      });
      const finishedAt = new Date().toISOString();
      enrichedPrompt = await fileStore.readText(enrichedPath).catch(() => "");
      const ok = result.exitCode === 0 && enrichedPrompt.trim().length > 0;
      stage = {
        status: ok ? "complete" : "failed",
        startedAt,
        finishedAt,
        durationMs: result.durationMs,
        provider,
        command: result.command,
        args: result.args,
        model: result.model,
        outputPath: enrichedPath,
        exitCode: result.exitCode,
        error: ok
          ? undefined
          : result.stderrTail || `CLI exited with ${result.exitCode}`,
      };
    }

    // Always (re)write the model run instructions — deterministic content.
    const modelInstructions = await loadModelInstructions();
    await fileStore.writeText(instructionsPath, modelInstructions);

    const updated = await runStore.update(opts.runId, (r) => ({
      ...r,
      // Producing a real enriched prompt clears any prior "skip enrichment"
      // choice, so the pipeline and Copy-prompt buttons use it instead of the
      // raw idea.
      inputs: {
        ...r.inputs,
        skipEnrichment:
          stage.status === "complete" ? false : r.inputs.skipEnrichment,
      },
      pipeline: {
        ...r.pipeline,
        stages: {
          ...r.pipeline.stages,
          prompt_enrichment: stage,
        },
      },
    }));

    if (stage.status === "failed") {
      throw internal(
        `Prompt enrichment failed (exit ${stage.exitCode ?? "?"}): ${(stage.error ?? "").slice(0, 500)}`,
      );
    }

    return { enrichedPrompt, modelInstructions, stage, run: updated };
  },
};

async function buildEnricherPrompt(run: RunJson): Promise<string> {
  const [template, originalIdea] = await Promise.all([
    fileStore.readText(ENRICHER_TEMPLATE),
    fileStore.readText(runPaths.originalIdea(run.run.runDir)),
  ]);
  return substitute(template, {
    DECISION_TYPE: DECISION_TYPE_LABELS[run.inputs.decisionType],
    CONSTRAINTS: run.inputs.constraints?.trim() || "(none provided)",
    BUDGET: run.inputs.budgetCap?.trim() || "(none provided)",
    ORIGINAL_IDEA: extractIdeaBody(originalIdea),
  });
}

function extractIdeaBody(originalIdeaMd: string): string {
  // The 00-original-idea.md file has metadata, then "## Idea\n\n<body>".
  const ideaMarker = originalIdeaMd.indexOf("## Idea");
  if (ideaMarker === -1) return originalIdeaMd.trim();
  const body = originalIdeaMd.slice(ideaMarker + "## Idea".length);
  return body.replace(/^[\s\n]+/, "").trim();
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*([A-Z_]+)\s*}}/g, (_, key: string) =>
    vars[key] ?? "",
  );
}

async function loadModelInstructions(): Promise<string> {
  return fileStore.readText(MODEL_INSTRUCTIONS_TEMPLATE);
}
