import { z } from "zod";
import {
  DecisionType,
  PipelineStage,
  RunMode,
  SourceInputMode,
  SourceName,
} from "./enums.js";

export const CreateRunRequest = z.object({
  topic: z.string().min(1, "Topic is required").max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  outputRoot: z.string().min(1, "Output root is required"),
  decisionType: DecisionType,
  originalIdea: z.string().min(1, "Original idea is required"),
  constraints: z.string().optional(),
  budgetCap: z.string().optional(),
  mode: RunMode.optional(),
});
export type CreateRunRequest = z.infer<typeof CreateRunRequest>;

export const UpdateRunRequest = z.object({
  topic: z.string().optional(),
  decisionType: DecisionType.optional(),
  constraints: z.string().optional(),
  budgetCap: z.string().optional(),
  mode: RunMode.optional(),
});
export type UpdateRunRequest = z.infer<typeof UpdateRunRequest>;

export const SaveSourceRequest = z
  .object({
    mode: SourceInputMode,
    content: z.string().optional(),
    filePath: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "paste" && !data.content) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "content required when mode is paste",
      });
    }
    if (data.mode === "file" && !data.filePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filePath"],
        message: "filePath required when mode is file",
      });
    }
  });
export type SaveSourceRequest = z.infer<typeof SaveSourceRequest>;

export const EnrichRequest = z.object({
  prompt: z.string().optional(),
  regenerate: z.boolean().optional(),
});
export type EnrichRequest = z.infer<typeof EnrichRequest>;

export const RerunStageRequest = z.object({
  rerunFromHere: z.boolean().optional(),
  customInstruction: z.string().optional(),
});
export type RerunStageRequest = z.infer<typeof RerunStageRequest>;

export const RunPipelineRequest = z.object({
  stages: z.array(PipelineStage).optional(),
});
export type RunPipelineRequest = z.infer<typeof RunPipelineRequest>;

export const ListRunsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListRunsQuery = z.infer<typeof ListRunsQuery>;

export const ReadFileQuery = z.object({
  path: z.string().min(1),
});
export type ReadFileQuery = z.infer<typeof ReadFileQuery>;

export const WriteFileBody = z.object({
  path: z.string().min(1),
  content: z.string(),
});
export type WriteFileBody = z.infer<typeof WriteFileBody>;

export const SourceParams = z.object({
  sourceName: SourceName,
});
export type SourceParams = z.infer<typeof SourceParams>;

export const StageParams = z.object({
  stageName: PipelineStage,
});
export type StageParams = z.infer<typeof StageParams>;

export const RunParams = z.object({
  runId: z.string().min(1),
});
export type RunParams = z.infer<typeof RunParams>;

// Generic API error envelope.
export const ApiError = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
