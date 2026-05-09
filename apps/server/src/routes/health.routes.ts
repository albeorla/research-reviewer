import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({
    ok: true,
    service: "rcc-server",
    version: "0.1.0",
    defaultOutputRoot: config.defaultOutputRoot,
    nodeVersion: process.version,
  }));
}
