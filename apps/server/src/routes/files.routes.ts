import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  ReadFileQuery,
  RunParams,
  WriteFileBody,
} from "@rcc/shared";
import { runStore } from "../services/runStore.js";
import { fileStore } from "../services/fileStore.js";
import { assertWithin } from "../utils/paths.js";
import { badRequest, notFound } from "../utils/errors.js";

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/runs/:runId/files/content", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const { path: relPath } = ReadFileQuery.parse(req.query);
    const run = await runStore.get(runId);
    const abs = path.resolve(run.run.runDir, relPath);
    assertWithin(run.run.runDir, abs);
    if (!(await fileStore.exists(abs))) {
      throw notFound(`File not found: ${relPath}`);
    }
    const content = await fileStore.readText(abs);
    return { path: relPath, content };
  });

  app.put("/api/runs/:runId/files/content", async (req) => {
    const { runId } = RunParams.parse(req.params);
    const body = WriteFileBody.parse(req.body);
    const run = await runStore.get(runId);
    const abs = path.resolve(run.run.runDir, body.path);
    assertWithin(run.run.runDir, abs);
    if (!isAllowedWritePath(run.run.runDir, abs)) {
      throw badRequest(
        `Write disallowed for path '${body.path}' — only artifacts under the run dir are editable.`,
      );
    }
    await fileStore.writeText(abs, body.content);
    return {
      path: body.path,
      content: body.content,
      savedAt: new Date().toISOString(),
    };
  });
}

// Reject writes to run.json or anything outside the documented artifact tree.
function isAllowedWritePath(runDir: string, abs: string): boolean {
  const rel = path.relative(runDir, abs);
  if (rel === "run.json") return false;
  return true;
}
