import path from "node:path";
import fs from "node:fs";
import url from "node:url";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the absolute path to the built web assets (apps/web/dist).
 * The server runs from apps/server/src/, so we walk up two levels.
 * Override with RCC_WEB_DIST if needed (e.g., a custom packager).
 */
export function resolveWebDistDir(): string | null {
  const override = process.env.RCC_WEB_DIST;
  if (override && fs.existsSync(path.join(override, "index.html"))) {
    return override;
  }
  const candidate = path.resolve(__dirname, "../../web/dist");
  return fs.existsSync(path.join(candidate, "index.html")) ? candidate : null;
}

/**
 * Register static file serving for the React SPA bundle.
 *
 * - Serves apps/web/dist for any non-/api GET request.
 * - SPA fallback: any unmatched GET that does not start with /api/
 *   returns index.html so client-side routing works on deep links.
 * - Long-cache for hashed assets, no-cache for index.html.
 *
 * If the dist directory is missing (e.g., dev mode where Vite handles
 * the UI on a separate port), this is a no-op.
 */
export async function registerStaticAssets(app: FastifyInstance): Promise<void> {
  const distDir = resolveWebDistDir();
  if (!distDir) {
    app.log.warn(
      "Web dist not found; static UI disabled. Run `pnpm build` to enable.",
    );
    return;
  }

  await app.register(fastifyStatic, {
    root: distDir,
    // Hashed assets in /assets/* are safe to cache forever (Vite content-hashes
    // them). index.html is served via the not-found handler with maxAge: 0
    // so a fresh `pnpm build` always serves new HTML.
    maxAge: "30d",
    immutable: true,
    // Don't auto-serve index.html for "/" — let the SPA fallback own it so the
    // cache-control override applies and "/" matches every other client route.
    index: false,
    // Don't register a catch-all GET; the SPA fallback (setNotFoundHandler)
    // owns unmatched routes so /api/* stays JSON.
    wildcard: false,
  });

  // SPA fallback: any GET (or HEAD) that did not match an API route or a static
  // file lands here. Return index.html so React Router renders the route
  // client-side. /api/* always returns JSON 404.
  app.setNotFoundHandler((req, reply) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      reply.code(404);
      return { error: "not_found", message: "Route not found" };
    }
    if (req.url.startsWith("/api/")) {
      reply.code(404);
      return { error: "not_found", message: "API route not found" };
    }
    return reply.sendFile("index.html", { maxAge: 0, immutable: false });
  });
}
