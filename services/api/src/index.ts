import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { Server } from "socket.io";
import { gamesRoutes } from "./routes/games.js";
import { sellersRoutes } from "./routes/sellers.js";
import { parlaysRoutes } from "./routes/parlays.js";
import { usersRoutes } from "./routes/users.js";
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

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) =>
      (request as { auth?: { userId?: string } }).auth?.userId ?? request.ip,
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
