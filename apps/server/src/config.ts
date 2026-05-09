import os from "node:os";
import path from "node:path";

const DEFAULT_OUTPUT_ROOT = path.join(os.homedir(), "research-runs");

export const config = {
  host: process.env.RCC_HOST ?? "127.0.0.1",
  port: Number(process.env.RCC_PORT ?? 3001),
  logLevel: process.env.RCC_LOG_LEVEL ?? "info",
  defaultOutputRoot: process.env.RCC_OUTPUT_ROOT ?? DEFAULT_OUTPUT_ROOT,
  isDev: process.env.NODE_ENV !== "production",
  sources: {
    minWords: Number(process.env.RCC_SOURCE_MIN_WORDS ?? 500),
    duplicateWarn: Number(process.env.RCC_SOURCE_DUPLICATE_WARN ?? 0.9),
    duplicateBlock: Number(process.env.RCC_SOURCE_DUPLICATE_BLOCK ?? 0.97),
  },
  pipeline: {
    stageTimeoutMs: Number(process.env.RCC_STAGE_TIMEOUT_MS ?? 15 * 60_000),
  },
} as const;

export type Config = typeof config;
