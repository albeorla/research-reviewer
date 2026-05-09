import { z } from "zod";
import { PipelineStage } from "./enums.js";
import { RunJson } from "./run.js";

export const StageStartedEvent = z.object({
  type: z.literal("stage_started"),
  stage: PipelineStage,
  startedAt: z.string().datetime(),
});

export const StageLogEvent = z.object({
  type: z.literal("stage_log"),
  stage: PipelineStage,
  stream: z.enum(["stdout", "stderr"]),
  text: z.string(),
});

export const StageCompletedEvent = z.object({
  type: z.literal("stage_completed"),
  stage: PipelineStage,
  exitCode: z.number().int(),
  durationMs: z.number().int(),
  outputPath: z.string(),
});

export const StageFailedEvent = z.object({
  type: z.literal("stage_failed"),
  stage: PipelineStage,
  error: z.string(),
  exitCode: z.number().int().optional(),
});

export const RunUpdatedEvent = z.object({
  type: z.literal("run_updated"),
  run: RunJson,
});

export const RunEvent = z.discriminatedUnion("type", [
  StageStartedEvent,
  StageLogEvent,
  StageCompletedEvent,
  StageFailedEvent,
  RunUpdatedEvent,
]);
export type RunEvent = z.infer<typeof RunEvent>;
