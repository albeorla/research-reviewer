import type { FastifyInstance } from "fastify";
import { RunParams } from "@rcc/shared";
import { exporter } from "../services/exporter.js";

export async function registerExportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post("/api/runs/:runId/export/markdown", async (req) => {
    const { runId } = RunParams.parse(req.params);
    return exporter.exportMarkdown(runId);
  });

  app.post("/api/runs/:runId/export/zip", async (req) => {
    const { runId } = RunParams.parse(req.params);
    return exporter.exportZip(runId);
  });

  app.post("/api/runs/:runId/export/pdf", async (req) => {
    const { runId } = RunParams.parse(req.params);
    return exporter.exportPdf(runId);
  });

  app.post("/api/runs/:runId/open-folder", async (req) => {
    const { runId } = RunParams.parse(req.params);
    return exporter.openFolder(runId);
  });
}
