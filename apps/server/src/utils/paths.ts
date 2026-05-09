import os from "node:os";
import path from "node:path";

/** Expand a leading "~" to the user's home directory. */
export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function resolveOutputRoot(input: string): string {
  return path.resolve(expandHome(input.trim()));
}

/**
 * Standard run folder layout helpers. The runDir is the absolute path to the
 * run's root directory (e.g. /Users/.../research-runs/ai-agent-ux-2026-05-09).
 */
export const runPaths = {
  originalIdea: (runDir: string) => path.join(runDir, "00-original-idea.md"),
  enrichedPrompt: (runDir: string) =>
    path.join(runDir, "01-enriched-research-prompt.md"),
  modelInstructions: (runDir: string) =>
    path.join(runDir, "02-model-run-instructions.md"),
  sourcesDir: (runDir: string) => path.join(runDir, "sources"),
  source: (runDir: string, name: string) =>
    path.join(runDir, "sources", `${name}-research.md`),
  reviewDir: (runDir: string) => path.join(runDir, "review"),
  decisionDir: (runDir: string) => path.join(runDir, "decision"),
  exportsDir: (runDir: string) => path.join(runDir, "exports"),
  runJson: (runDir: string) => path.join(runDir, "run.json"),
  readme: (runDir: string) => path.join(runDir, "README.md"),
} as const;

/** Throws if `target` is not inside `root` (defends against path traversal). */
export function assertWithin(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Path ${resolvedTarget} is outside the allowed root ${resolvedRoot}`,
    );
  }
}
