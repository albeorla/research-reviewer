import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { config } from "./config.js";
import { HttpError } from "./utils/errors.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerRunRoutes } from "./routes/runs.routes.js";
import { registerFileRoutes } from "./routes/files.routes.js";
import { registerSourceRoutes } from "./routes/sources.routes.js";
import { registerPipelineRoutes } from "./routes/pipeline.routes.js";
import { registerExportRoutes } from "./routes/export.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: config.isDev
      ? {
          level: config.logLevel,
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }
      : { level: config.logLevel },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      reply.code(400);
      return {
        error: "validation_error",
        message: "Request validation failed",
        details: err.flatten(),
      };
    }
    if (err instanceof HttpError) {
      reply.code(err.status);
      return {
        error: err.code,
        message: err.message,
        details: err.details,
      };
    }
    app.log.error({ err }, "Unhandled error");
    reply.code(500);
    const message =
      err instanceof Error && err.message ? err.message : "Unknown server error";
    return {
      error: "internal_error",
      message,
    };
  });

  await registerHealthRoutes(app);
  await registerRunRoutes(app);
  await registerFileRoutes(app);
  await registerSourceRoutes(app);
  await registerPipelineRoutes(app);
  await registerExportRoutes(app);

  return app;
}
