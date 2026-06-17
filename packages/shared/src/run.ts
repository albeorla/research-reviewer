import { z } from "zod";
import {
  CliProvider,
  DecisionType,
  RunMode,
  SourceInputMode,
  SourceName,
  SourceValidationStatus,
  StageStatus,
  SOURCE_NAMES,
} from "./enums.js";

export const SourceValidation = z.object({
  status: SourceValidationStatus,
  warnings: z.array(z.string()),
});
export type SourceValidation = z.infer<typeof SourceValidation>;

export const SourceState = z.object({
  mode: SourceInputMode,
  path: z.string(),
  wordCount: z.number().int().min(0),
  approxTokenCount: z.number().int().min(0),
  savedAt: z.string().datetime().nullable(),
  validation: SourceValidation,
  // Whether this provider participates in the run. Disabled providers are not
  // required, not counted as missing, and excluded from the review pipeline.
  // Older run.json files have no field; consumers treat absence as enabled via
  // `activeSourceNames` (`enabled !== false`), since run.json is read without
  // applying this zod default.
  enabled: z.boolean().default(true),
});
export type SourceState = z.infer<typeof SourceState>;

export const SourcesMap = z.object({
  chatgpt: SourceState,
  claude: SourceState,
  gemini: SourceState,
  deepseek: SourceState,
  kimi: SourceState,
});
export type SourcesMap = z.infer<typeof SourcesMap>;

export const RunInputs = z.object({
  topic: z.string(),
  decisionType: DecisionType,
  constraints: z.string().default(""),
  budgetCap: z.string().default(""),
  originalIdeaPath: z.string(),
  enrichedPromptPath: z.string(),
  modelInstructionsPath: z.string(),
  // When true, the enrich stage is bypassed and the raw idea is used as the
  // research prompt. Absent in older run.json files; consumers treat a missing
  // value as false (`skipEnrichment ?? false`).
  skipEnrichment: z.boolean().default(false),
  sources: SourcesMap,
});
export type RunInputs = z.infer<typeof RunInputs>;

export const StageState = z.object({
  status: StageStatus,
  startedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  provider: CliProvider.optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  model: z.string().optional(),
  outputPath: z.string().optional(),
  exitCode: z.number().int().optional(),
  error: z.string().optional(),
});
export type StageState = z.infer<typeof StageState>;

export const RunPipeline = z.object({
  stages: z.record(z.string(), StageState),
});
export type RunPipeline = z.infer<typeof RunPipeline>;

export const RunExports = z.object({
  markdownPath: z.string().optional(),
  pdfPath: z.string().optional(),
  zipPath: z.string().optional(),
  exportedAt: z.string().datetime().optional(),
});
export type RunExports = z.infer<typeof RunExports>;

export const RunMeta = z.object({
  id: z.string(),
  slug: z.string(),
  date: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  outputRoot: z.string(),
  runDir: z.string(),
  mode: RunMode,
});
export type RunMeta = z.infer<typeof RunMeta>;

export const RunJson = z.object({
  schemaVersion: z.literal(1),
  run: RunMeta,
  inputs: RunInputs,
  pipeline: RunPipeline,
  exports: RunExports,
});
export type RunJson = z.infer<typeof RunJson>;

/** Minimum number of enabled providers required to run the review pipeline. */
export const MIN_ACTIVE_SOURCES = 2;

/**
 * Providers that participate in this run. A source counts as active unless it
 * is explicitly disabled (`enabled === false`), so runs created before the
 * enabled flag existed are treated as fully enabled.
 */
export function activeSourceNames(run: RunJson): SourceName[] {
  return SOURCE_NAMES.filter((n) => run.inputs.sources[n]?.enabled !== false);
}

// Compact summary used in run lists.
export const RunSummary = z.object({
  id: z.string(),
  slug: z.string(),
  date: z.string(),
  topic: z.string(),
  decisionType: DecisionType,
  runDir: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RunSummary = z.infer<typeof RunSummary>;
