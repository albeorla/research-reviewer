import type { FastifyInstance } from "fastify";
import {
  RunParams,
  SaveSourceRequest,
  SourceParams,
} from "@rcc/shared";
import { sourceStore } from "../services/sourceStore.js";

export async function registerSourceRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/runs/:runId/sources", async (req) => {
    const { runId } = RunParams.parse(req.params);
    return sourceStore.list(runId);
  });

  app.post("/api/runs/:runId/sources/:sourceName", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const { sourceName } = SourceParams.parse(req.params);
    const body = SaveSourceRequest.parse(req.body);
    return sourceStore.save(runId, sourceName, body);
  });
}
