import type { FastifyInstance } from "fastify";
import {
  RerunStageRequest,
  RunParams,
  StageParams,
} from "@rcc/shared";
import { stageRunner } from "../services/stageRunner.js";
import { pipelineRunner } from "../services/pipelineRunner.js";

export async function registerPipelineRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/api/runs/:runId/pipeline/stages/:stageName/run",
    async (req) => {
      const { runId } = RunParams.parse(req.params);
      const { stageName } = StageParams.parse(req.params);
      const body = RerunStageRequest.parse(req.body ?? {});
      return stageRunner.run({
        runId,
        stage: stageName,
        skipDependencyCheck: body.rerunFromHere === true,
      });
    },
  );

  app.post("/api/runs/:runId/pipeline/run", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const body = (req.body as { fromStage?: string } | undefined) ?? {};
    const run = await pipelineRunner.runReview(
      runId,
      body.fromStage as never,
    );
    return { ok: true, run, running: true };
  });

  app.post("/api/runs/:runId/cancel", async (req) => {
    const { runId } = RunParams.parse(req.params);
    pipelineRunner.cancel(runId);
    return { ok: true };
  });

  app.get("/api/runs/:runId/events", (req, reply) => {
    const { runId } = RunParams.parse(req.params);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // Initial comment so curl/EventSource know we're connected.
    reply.raw.write(": connected\n\n");

    const unsubscribe = pipelineRunner.subscribe(runId, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Heartbeat so reverse proxies and EventSource keep the connection open.
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 15_000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
