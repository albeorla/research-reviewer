import {
  approxTokenCount,
  SOURCE_NAME_LABELS,
  SourceName,
  SourceValidation,
  SourceValidationStatus,
  wordCount,
} from "@rcc/shared";
import { config } from "../config.js";

const REFUSAL_PATTERNS = [
  /\bi (can'?t|cannot|won'?t)\b/i,
  /\bi am unable\b/i,
  /\bi'?m not able\b/i,
  /\bas an ai\b/i,
  /\bi must decline\b/i,
  /\bi (don'?t|do not) (have|provide|generate)\b/i,
  /\bi'?m (sorry|afraid)[,.]?\s+(but|i)\b/i,
];

export interface SourceMetrics {
  wordCount: number;
  approxTokenCount: number;
}

export function metricsFor(content: string): SourceMetrics {
  return {
    wordCount: wordCount(content),
    approxTokenCount: approxTokenCount(content),
  };
}

export interface ValidateInput {
  name: SourceName;
  content: string;
  others: Array<{ name: SourceName; content: string }>;
}

export function validateSource(input: ValidateInput): SourceValidation {
  const warnings: string[] = [];
  let status: SourceValidationStatus = "valid";

  const text = input.content.trim();
  const wc = wordCount(text);

  if (wc === 0) {
    return { status: "error", warnings: ["No content saved yet"] };
  }

  if (wc < config.sources.minWords) {
    warnings.push(
      `Below minimum length (${wc} words, expected ${config.sources.minWords}+)`,
    );
    status = bumpStatus(status, "warning");
  }

  if (!hasMarkdownHeadings(text)) {
    warnings.push("No Markdown headings found — output may not be structured");
    status = bumpStatus(status, "warning");
  }

  if (looksLikeRefusal(text)) {
    warnings.push("Output looks like a refusal or incomplete response");
    status = bumpStatus(status, "warning");
  }

  if (looksLikeRawPrompt(text)) {
    warnings.push("Output appears to be the prompt itself rather than an answer");
    status = bumpStatus(status, "warning");
  }

  for (const other of input.others) {
    if (other.name === input.name) continue;
    const sim = jaccardSimilarity(text, other.content);
    if (sim >= config.sources.duplicateBlock) {
      warnings.push(
        `Hard duplicate of ${SOURCE_NAME_LABELS[other.name]} (Jaccard ${sim.toFixed(2)})`,
      );
      status = bumpStatus(status, "error");
    } else if (sim >= config.sources.duplicateWarn) {
      warnings.push(
        `Near-duplicate of ${SOURCE_NAME_LABELS[other.name]} (Jaccard ${sim.toFixed(2)})`,
      );
      status = bumpStatus(status, "warning");
    }
  }

  return { status, warnings };
}

function hasMarkdownHeadings(text: string): boolean {
  return /^#{1,6}\s/m.test(text);
}

function looksLikeRefusal(text: string): boolean {
  const head = text.slice(0, 800);
  return REFUSAL_PATTERNS.some((p) => p.test(head));
}

function looksLikeRawPrompt(text: string): boolean {
  // Heuristic: docs that look like the enricher template carry these markers.
  const markers = [
    "## Required Questions To Answer",
    "## Evidence Requirements",
    "## Comparison Criteria",
    "{{ORIGINAL_IDEA}}",
    "{{DECISION_TYPE}}",
  ];
  return markers.some((m) => text.includes(m)) && wordCount(text) < 1500;
}

function bumpStatus(
  current: SourceValidationStatus,
  next: SourceValidationStatus,
): SourceValidationStatus {
  const order: SourceValidationStatus[] = ["valid", "warning", "error"];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

/**
 * Jaccard similarity over the union of word-bigrams. Bigrams discriminate
 * better than unigrams because two long structured docs often share a lot of
 * common vocabulary but rarely the same bigrams.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = bigramSet(a);
  const setB = bigramSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function bigramSet(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    set.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return set;
}
