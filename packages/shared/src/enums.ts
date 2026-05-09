import { z } from "zod";

export const SourceName = z.enum([
  "chatgpt",
  "claude",
  "gemini",
  "deepseek",
  "kimi",
]);
export type SourceName = z.infer<typeof SourceName>;
export const SOURCE_NAMES = SourceName.options;

export const SOURCE_NAME_LABELS: Record<SourceName, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

export const SOURCE_OPEN_URLS: Record<SourceName, string> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/app",
  deepseek: "https://chat.deepseek.com/",
  kimi: "https://kimi.com/",
};

export const DecisionType = z.enum([
  "open_research",
  "technical_architecture",
  "product_decision",
  "vendor_tool_comparison",
  "market_strategy",
  "policy_legal",
  "other",
]);
export type DecisionType = z.infer<typeof DecisionType>;
export const DECISION_TYPES = DecisionType.options;

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  open_research: "Open research",
  technical_architecture: "Technical architecture",
  product_decision: "Product decision",
  vendor_tool_comparison: "Vendor / tool comparison",
  market_strategy: "Market / strategy",
  policy_legal: "Policy / legal-ish",
  other: "Other",
};

export const RunMode = z.enum(["standard", "deep", "custom"]);
export type RunMode = z.infer<typeof RunMode>;

export const PipelineStage = z.enum([
  "prompt_enrichment",
  "source_audit",
  "evidence_critic",
  "decision_critic",
  "contrarian_critic",
  "critique_synthesis",
  "decision_draft",
  "final_red_team",
  "final_decision",
  "exports",
]);
export type PipelineStage = z.infer<typeof PipelineStage>;
export const PIPELINE_STAGES = PipelineStage.options;

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  prompt_enrichment: "Prompt enrichment",
  source_audit: "Source audit",
  evidence_critic: "Evidence critic",
  decision_critic: "Decision critic",
  contrarian_critic: "Contrarian critic",
  critique_synthesis: "Critique synthesis",
  decision_draft: "Decision draft",
  final_red_team: "Final red-team",
  final_decision: "Final decision",
  exports: "Exports",
};

// Ordered stage list for the review pipeline (excludes prompt_enrichment and exports).
export const REVIEW_PIPELINE_STAGES: PipelineStage[] = [
  "source_audit",
  "evidence_critic",
  "decision_critic",
  "contrarian_critic",
  "critique_synthesis",
  "decision_draft",
  "final_red_team",
  "final_decision",
];

export const StageStatus = z.enum([
  "pending",
  "running",
  "complete",
  "failed",
  "skipped",
]);
export type StageStatus = z.infer<typeof StageStatus>;

export const CliProvider = z.enum(["codex", "claude"]);
export type CliProvider = z.infer<typeof CliProvider>;

export const SourceInputMode = z.enum(["paste", "file"]);
export type SourceInputMode = z.infer<typeof SourceInputMode>;

export const SourceValidationStatus = z.enum(["valid", "warning", "error"]);
export type SourceValidationStatus = z.infer<typeof SourceValidationStatus>;

export const WizardStep = z.enum([
  "define",
  "enrich",
  "collect",
  "review",
  "decide",
  "export",
]);
export type WizardStep = z.infer<typeof WizardStep>;
export const WIZARD_STEPS = WizardStep.options;

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  define: "Define",
  enrich: "Enrich",
  collect: "Collect",
  review: "Review",
  decide: "Decide",
  export: "Export",
};
