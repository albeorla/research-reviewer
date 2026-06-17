import {
  MIN_ACTIVE_SOURCES,
  PipelineStage,
  REVIEW_PIPELINE_STAGES,
  RunEvent,
  RunJson,
  SOURCE_NAME_LABELS,
  activeSourceNames,
} from "@rcc/shared";
import { stageRunner } from "./stageRunner.js";
import { runStore } from "./runStore.js";
import { conflict, badRequest } from "../utils/errors.js";

type Group = PipelineStage | PipelineStage[];

/**
 * Ordered execution graph for the review pipeline. Inner arrays are
 * parallelisable. The three critics run together; everything else is
 * sequential because each stage consumes the previous one's artifact.
 */
const REVIEW_GRAPH: Group[] = [
  ["evidence_critic", "decision_critic", "contrarian_critic"],
  "critique_synthesis",
  "decision_draft",
  "final_red_team",
  "final_decision",
];

type Subscriber = (event: RunEvent) => void;

class PipelineRunner {
  private readonly active = new Map<string, AbortController>();
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  isRunning(runId: string): boolean {
    return this.active.has(runId);
  }

  subscribe(runId: string, sub: Subscriber): () => void {
    const set = this.subscribers.get(runId) ?? new Set();
    set.add(sub);
    this.subscribers.set(runId, set);
    return () => {
      set.delete(sub);
      if (set.size === 0) this.subscribers.delete(runId);
    };
  }

  cancel(runId: string): void {
    this.active.get(runId)?.abort();
  }

  /**
   * Kicks off the full review pipeline. Returns immediately with the run state
   * after marking pipeline stages as pending; events are delivered via
   * subscribers (SSE).
   */
  async runReview(runId: string, fromStage?: PipelineStage): Promise<RunJson> {
    if (this.active.has(runId)) {
      throw conflict(`Pipeline already running for ${runId}`);
    }
    const initial = await runStore.get(runId);
    assertReadyForReview(initial);

    const groups = filterGraph(REVIEW_GRAPH, fromStage);

    // Reset the affected stages to pending so the UI shows them in flight.
    const affectedStages = new Set<PipelineStage>();
    for (const g of groups) {
      if (Array.isArray(g)) for (const s of g) affectedStages.add(s);
      else affectedStages.add(g);
    }
    const reset = await runStore.update(runId, (r) => {
      const next = { ...r.pipeline.stages };
      for (const s of affectedStages) next[s] = { status: "pending" };
      return { ...r, pipeline: { ...r.pipeline, stages: next } };
    });
    this.emit(runId, { type: "run_updated", run: reset });

    const abort = new AbortController();
    this.active.set(runId, abort);

    // Run async; do not await so the caller returns immediately.
    void this.executeGraph(runId, groups, abort.signal).catch(() => undefined);

    return reset;
  }

  private async executeGraph(
    runId: string,
    groups: Group[],
    signal: AbortSignal,
  ): Promise<void> {
    try {
      for (const group of groups) {
        if (signal.aborted) {
          this.emit(runId, {
            type: "stage_failed",
            stage: groupHead(group),
            error: "Cancelled by user",
          });
          return;
        }
        if (Array.isArray(group)) {
          await Promise.all(group.map((s) => this.executeStage(runId, s)));
        } else {
          await this.executeStage(runId, group);
        }
      }
      const final = await runStore.get(runId);
      this.emit(runId, { type: "run_updated", run: final });
    } catch (err) {
      // Stage already emitted stage_failed; nothing else to do.
      void err;
    } finally {
      this.active.delete(runId);
    }
  }

  private async executeStage(
    runId: string,
    stage: PipelineStage,
  ): Promise<void> {
    this.emit(runId, {
      type: "stage_started",
      stage,
      startedAt: new Date().toISOString(),
    });
    try {
      const result = await stageRunner.run({
        runId,
        stage,
        skipDependencyCheck: true,
        onEvent: (e) => {
          if (e.type === "log" && e.text && e.stream) {
            this.emit(runId, {
              type: "stage_log",
              stage,
              stream: e.stream,
              text: e.text,
            });
          }
        },
      });
      this.emit(runId, {
        type: "stage_completed",
        stage,
        exitCode: result.stage.exitCode ?? 0,
        durationMs: result.stage.durationMs ?? 0,
        outputPath: result.stage.outputPath ?? "",
      });
      this.emit(runId, { type: "run_updated", run: result.run });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit(runId, { type: "stage_failed", stage, error: message });
      throw err;
    }
  }

  private emit(runId: string, event: RunEvent): void {
    const set = this.subscribers.get(runId);
    if (!set) return;
    for (const sub of set) {
      try {
        sub(event);
      } catch {
        // ignore subscriber errors
      }
    }
  }
}

function assertReadyForReview(run: RunJson): void {
  const audit = run.pipeline.stages.source_audit;
  if (!audit || audit.status !== "complete") {
    throw badRequest(
      "Source audit must complete before running the review pipeline.",
    );
  }
  const active = activeSourceNames(run);
  if (active.length < MIN_ACTIVE_SOURCES) {
    throw badRequest(
      `At least ${MIN_ACTIVE_SOURCES} providers must be enabled to run the review pipeline (currently ${active.length}).`,
    );
  }
  for (const name of active) {
    const s = run.inputs.sources[name];
    if (!s.savedAt) {
      throw badRequest(
        `Source '${SOURCE_NAME_LABELS[name]}' is enabled but has not been saved.`,
      );
    }
  }
}

function filterGraph(
  graph: Group[],
  fromStage?: PipelineStage,
): Group[] {
  if (!fromStage) return graph;
  const idx = graph.findIndex((g) =>
    Array.isArray(g) ? g.includes(fromStage) : g === fromStage,
  );
  if (idx === -1) return graph;
  return graph.slice(idx);
}

function groupHead(group: Group): PipelineStage {
  return Array.isArray(group) ? (group[0] as PipelineStage) : group;
}

export const pipelineRunner = new PipelineRunner();
export { REVIEW_GRAPH, REVIEW_PIPELINE_STAGES };
