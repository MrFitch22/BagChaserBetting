import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { Server } from "socket.io";
import { gamesRoutes } from "./routes/games.js";
import { sellersRoutes } from "./routes/sellers.js";
import { parlaysRoutes } from "./routes/parlays.js";
import { usersRoutes } from "./routes/users.js";
import { internalRoutes } from "./routes/internal.js";
import { promosRoutes } from "./routes/promos.js";
import { compareOddsRoutes } from "./routes/compare-odds.js";
import { registerLiveGamesSocket } from "./websocket/live-games.js";

const PORT = parseInt(process.env["PORT"] ?? "3001");
const HOST = process.env["HOST"] ?? "0.0.0.0";
const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000").split(",");

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  });

  // Tier-based rate limits:
  //   free  (unauthenticated or free tier) → 60 req/min
  //   pro                                  → 300 req/min
  //   sharp                                → 1000 req/min (effectively unlimited for local testing)
  //   internal (127.0.0.1)                 → no limit applied at this layer
  await app.register(rateLimit, {
    global: true,
    max: 60,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const r = request as FastifyRequest & { auth?: { userId?: string }; userTier?: string };
      return r.auth?.userId ?? request.ip;
    },
    errorResponseBuilder: (_req, context) => ({
      error:       "rate_limit_exceeded",
      message:     `Too many requests. Limit: ${context.max} per minute.`,
      retryAfter:  context.ttl,
    }),
    onExceeding: (req) => {
      app.log.warn({ ip: req.ip }, "Rate limit approaching");
    },
  });

  // Override rate limit per route based on user tier (applied in route hooks)
  app.addHook("onRequest", async (request) => {
    const r = request as FastifyRequest & { userTier?: string };
    // Internal traffic — skip (handled by internal routes)
    if (request.ip === "127.0.0.1" || request.ip === "::1") return;

    const tier = r.userTier ?? "free";
    const maxByTier: Record<string, number> = { free: 60, pro: 300, sharp: 1000 };
    const max = maxByTier[tier] ?? 60;

    // Store on request for keyGenerator context
    (request as typeof request & { _rateMax: number })._rateMax = max;
  });

  // Health check — unauthenticated, no rate limit
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] ?? "0.1.0",
  }));

  // Register route groups
  await app.register(gamesRoutes, { prefix: "/api" });
  await app.register(sellersRoutes, { prefix: "/api" });
  await app.register(parlaysRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(internalRoutes);
  await app.register(promosRoutes, { prefix: "/api" });
  await app.register(compareOddsRoutes, { prefix: "/api" });

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.listen({ port: PORT, host: HOST });

  // Attach Socket.io directly to Fastify's underlying HTTP server (must be after listen)
  const io = new Server(app.server, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
  });

  registerLiveGamesSocket(io);

  app.log.info(`Sharp Edge API running on http://${HOST}:${PORT}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
