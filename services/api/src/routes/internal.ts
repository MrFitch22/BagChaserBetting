import type { FastifyInstance } from "fastify";
import { getSocketHandlers } from "../websocket/live-games.js";

// Internal routes — localhost only, no auth, no rate limit
// Used by the pipeline service to push real-time events into Socket.io

export async function internalRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const ip = request.ip;
    if (ip !== "127.0.0.1" && ip !== "::1" && ip !== "::ffff:127.0.0.1") {
      return reply.status(403).send({ error: "internal_only" });
    }
  });

  // POST /internal/sharp-alert — pipeline calls this when a sharp move is detected
  app.post<{
    Body: {
      gameId: string;
      homeTeam: string;
      awayTeam: string;
      market: string;
      label: string;
      priceBefore: number;
      priceAfter: number;
      books: string[];
    };
  }>("/internal/sharp-alert", async (request, reply) => {
    const { gameId, homeTeam, awayTeam, market, label, priceBefore, priceAfter, books } = request.body;

    const direction = priceAfter > priceBefore ? "up" : "down";

    getSocketHandlers()?.pushSharpAlert({
      gameId,
      market,
      label,
      direction,
      books,
    });

    app.log.info({ gameId, market, label, direction }, "Sharp alert broadcast");
    return reply.send({ ok: true });
  });
}
