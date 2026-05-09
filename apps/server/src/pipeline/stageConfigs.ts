import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CliProvider,
  PipelineStage,
  RunJson,
  SOURCE_NAMES,
  SOURCE_NAME_LABELS,
} from "@rcc/shared";
import { runPaths } from "../utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src/pipeline -> ../../../../prompts
const PROMPTS_DIR = path.resolve(__dirname, "../../../../prompts");

export interface StageInput {
  label: string;
  path: string;
  /** Skip if missing instead of erroring. */
  optional?: boolean;
}

export interface StageConfig {
  stage: PipelineStage;
  /** Heading shown above the stage in the UI. */
  displayName: string;
  /** Path to the prompt-template markdown file. */
  templatePath: string;
  /** Inputs interpolated as a "# INPUTS" section appended to the template. */
  inputs: (run: RunJson) => StageInput[];
  /** Output artifact (overwritten on rerun). */
  outputPath: (run: RunJson) => string;
  provider: CliProvider;
  model: string;
  /** Stages that must be `complete` before this one runs. */
  dependsOn?: PipelineStage[];
  timeoutMs?: number;
}

const reviewArtifact = (file: string) => (run: RunJson) =>
  path.join(runPaths.reviewDir(run.run.runDir), file);

const decisionArtifact = (file: string) => (run: RunJson) =>
  path.join(runPaths.decisionDir(run.run.runDir), file);

const allSources = (run: RunJson): StageInput[] =>
  SOURCE_NAMES.map((n) => ({
    label: SOURCE_NAME_LABELS[n],
    path: runPaths.source(run.run.runDir, n),
  }));

const enrichedPromptInput = (run: RunJson): StageInput => ({
  label: "Enriched research prompt",
  path: runPaths.enrichedPrompt(run.run.runDir),
});

export const STAGE_CONFIGS: Partial<Record<PipelineStage, StageConfig>> = {
  source_audit: {
    stage: "source_audit",
    displayName: "Source audit",
    templatePath: path.join(PROMPTS_DIR, "source-audit.md"),
    inputs: (run) => [enrichedPromptInput(run), ...allSources(run)],
    outputPath: reviewArtifact("10-source-audit.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: [],
  },
  evidence_critic: {
    stage: "evidence_critic",
    displayName: "Evidence critic",
    templatePath: path.join(PROMPTS_DIR, "evidence-critic.md"),
    inputs: (run) => [enrichedPromptInput(run), ...allSources(run)],
    outputPath: reviewArtifact("20-evidence-critic.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["source_audit"],
  },
  decision_critic: {
    stage: "decision_critic",
    displayName: "Decision critic",
    templatePath: path.join(PROMPTS_DIR, "decision-critic.md"),
    inputs: (run) => [enrichedPromptInput(run), ...allSources(run)],
    outputPath: reviewArtifact("21-decision-critic.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["source_audit"],
  },
  contrarian_critic: {
    stage: "contrarian_critic",
    displayName: "Contrarian critic",
    templatePath: path.join(PROMPTS_DIR, "contrarian-critic.md"),
    inputs: (run) => [enrichedPromptInput(run), ...allSources(run)],
    outputPath: reviewArtifact("22-contrarian-critic.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["source_audit"],
  },
  critique_synthesis: {
    stage: "critique_synthesis",
    displayName: "Critique synthesis",
    templatePath: path.join(PROMPTS_DIR, "critique-synthesis.md"),
    inputs: (run) => [
      enrichedPromptInput(run),
      {
        label: "Evidence critic",
        path: reviewArtifact("20-evidence-critic.md")(run),
      },
      {
        label: "Decision critic",
        path: reviewArtifact("21-decision-critic.md")(run),
      },
      {
        label: "Contrarian critic",
        path: reviewArtifact("22-contrarian-critic.md")(run),
      },
    ],
    outputPath: reviewArtifact("24-critique-synthesis.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["evidence_critic", "decision_critic", "contrarian_critic"],
  },
  decision_draft: {
    stage: "decision_draft",
    displayName: "Decision draft",
    templatePath: path.join(PROMPTS_DIR, "consolidator.md"),
    inputs: (run) => [
      enrichedPromptInput(run),
      ...allSources(run),
      {
        label: "Critique synthesis",
        path: reviewArtifact("24-critique-synthesis.md")(run),
      },
    ],
    outputPath: decisionArtifact("30-consolidated-decision-draft.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["critique_synthesis"],
  },
  final_red_team: {
    stage: "final_red_team",
    displayName: "Final red-team",
    templatePath: path.join(PROMPTS_DIR, "final-red-team.md"),
    inputs: (run) => [
      enrichedPromptInput(run),
      ...allSources(run),
      {
        label: "Critique synthesis",
        path: reviewArtifact("24-critique-synthesis.md")(run),
      },
      {
        label: "Decision draft",
        path: decisionArtifact("30-consolidated-decision-draft.md")(run),
      },
    ],
    outputPath: decisionArtifact("40-final-red-team-check.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["decision_draft"],
  },
  final_decision: {
    stage: "final_decision",
    displayName: "Final decision",
    templatePath: path.join(PROMPTS_DIR, "final-consolidator.md"),
    inputs: (run) => [
      enrichedPromptInput(run),
      {
        label: "Decision draft",
        path: decisionArtifact("30-consolidated-decision-draft.md")(run),
      },
      {
        label: "Final red-team check",
        path: decisionArtifact("40-final-red-team-check.md")(run),
      },
    ],
    outputPath: decisionArtifact("50-consolidated-decision.md"),
    provider: "claude",
    model: "sonnet",
    dependsOn: ["final_red_team"],
  },
};

export function getStageConfig(stage: PipelineStage): StageConfig | null {
  return STAGE_CONFIGS[stage] ?? null;
}
