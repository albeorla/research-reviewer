import { buildApp } from "./app.js";
import { config } from "./config.js";

async function main() {
  const app = await buildApp();
  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(
      `Default output root: ${config.defaultOutputRoot} (override with RCC_OUTPUT_ROOT)`,
    );
  } catch (err) {
    app.log.error({ err }, "Failed to start server");
    process.exit(1);
  }

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, async () => {
      app.log.info(`Received ${sig}, shutting down`);
      await app.close();
      process.exit(0);
    });
  }
}

main();
