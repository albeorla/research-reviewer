import type { FastifyInstance } from "fastify";
import {
  CreateRunRequest,
  EnrichRequest,
  ListRunsQuery,
  RunParams,
  UpdateRunRequest,
} from "@rcc/shared";
import { runStore } from "../services/runStore.js";
import { promptEnricher } from "../services/promptEnricher.js";
import { fileStore } from "../services/fileStore.js";
import { runPaths } from "../utils/paths.js";

export async function registerRunRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/runs", async (req, reply) => {
    const body = CreateRunRequest.parse(req.body);
    const run = await runStore.create(body);
    reply.code(201);
    return run;
  });

  app.get("/api/runs", async (req) => {
    const query = ListRunsQuery.parse(req.query);
    const runs = await runStore.list(query.limit);
    return { runs };
  });

  app.get("/api/runs/:runId", async (req) => {
    const { runId } = RunParams.parse(req.params);
    return runStore.get(runId);
  });

  app.patch("/api/runs/:runId", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const patch = UpdateRunRequest.parse(req.body);
    return runStore.update(runId, (run) => ({
      ...run,
      inputs: {
        ...run.inputs,
        topic: patch.topic ?? run.inputs.topic,
        decisionType: patch.decisionType ?? run.inputs.decisionType,
        constraints: patch.constraints ?? run.inputs.constraints,
        budgetCap: patch.budgetCap ?? run.inputs.budgetCap,
      },
      run: {
        ...run.run,
        mode: patch.mode ?? run.run.mode,
      },
    }));
  });

  app.get("/api/runs/:runId/enrich", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const run = await runStore.get(runId);
    const enrichedPath = runPaths.enrichedPrompt(run.run.runDir);
    const instructionsPath = runPaths.modelInstructions(run.run.runDir);
    const [enrichedExists, instructionsExists] = await Promise.all([
      fileStore.exists(enrichedPath),
      fileStore.exists(instructionsPath),
    ]);
    const [enrichedPrompt, modelInstructions] = await Promise.all([
      enrichedExists ? fileStore.readText(enrichedPath) : null,
      instructionsExists ? fileStore.readText(instructionsPath) : null,
    ]);
    return { enrichedPrompt, modelInstructions, run };
  });

  app.post("/api/runs/:runId/enrich", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const body = EnrichRequest.parse(req.body ?? {});
    return promptEnricher.enrich({
      runId,
      manualPrompt: body.prompt,
    });
  });
}
