import type { FastifyInstance } from "fastify";
import { eq, gte, lte, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { games, oddsHistory, confidenceScores } from "../db/schema.js";
import { redis, CACHE_TTL } from "../db/redis.js";
import { optionalAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier.js";

export async function gamesRoutes(app: FastifyInstance) {
  // GET /api/games — upcoming + live games
  app.get("/games", { preHandler: [optionalAuth] }, async (request, reply) => {
    const cacheKey = "games:today";
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(cached);

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const rows = await db.query.games.findMany({
      where: and(gte(games.gameTime, now.toISOString()), lte(games.gameTime, tomorrow.toISOString())),
      orderBy: games.gameTime,
      limit: 50,
    });

    await redis.setex(cacheKey, CACHE_TTL.game, JSON.stringify(rows));
    return reply.send(rows);
  });

  // GET /api/games/:id — single game with current odds
  app.get<{ Params: { id: string } }>("/games/:id", async (request, reply) => {
    const { id } = request.params;

    const game = await db.query.games.findFirst({
      where: eq(games.id, id),
    });

    if (!game) return reply.status(404).send({ error: "game_not_found" });

    const odds = await db.query.oddsHistory.findMany({
      where: and(
        eq(oddsHistory.gameId, id),
        gte(oddsHistory.capturedAt, new Date(Date.now() - 10 * 60 * 1000).toISOString())
      ),
      orderBy: oddsHistory.capturedAt,
    });

    return reply.send({ game, odds });
  });

  // GET /api/games/:id/odds-history — line movement history
  app.get<{ Params: { id: string } }>("/games/:id/odds-history", async (request, reply) => {
    const { id } = request.params;

    const history = await db.query.oddsHistory.findMany({
      where: eq(oddsHistory.gameId, id),
      orderBy: oddsHistory.capturedAt,
      limit: 500,
    });

    return reply.send(history);
  });

  // GET /api/scores/top-edges — today's top confidence scores (Pro+)
  app.get(
    "/scores/top-edges",
    { preHandler: [requireTier("pro")] },
    async (_request, reply) => {
      const cacheKey = "scores:top-edges";
      const cached = await redis.get(cacheKey);
      if (cached) return reply.send(cached);

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const scores = await db
        .select({
          score: confidenceScores,
          game: games,
        })
        .from(confidenceScores)
        .innerJoin(games, eq(confidenceScores.gameId, games.id))
        .where(
          and(
            gte(games.gameTime, now.toISOString()),
            lte(games.gameTime, tomorrow.toISOString()),
            gte(confidenceScores.score, "65")
          )
        )
        .orderBy(confidenceScores.score)
        .limit(20);

      await redis.setex(cacheKey, CACHE_TTL.confidence, JSON.stringify(scores));
      return reply.send(scores);
    }
  );

  // GET /api/scores/:gameId/:market — confidence score for one market (Pro+)
  app.get<{ Params: { gameId: string; market: string } }>(
    "/scores/:gameId/:market",
    { preHandler: [requireTier("pro")] },
    async (request, reply) => {
      const { gameId, market } = request.params;

      const score = await db.query.confidenceScores.findFirst({
        where: and(eq(confidenceScores.gameId, gameId), eq(confidenceScores.market, market)),
        orderBy: confidenceScores.computedAt,
      });

      if (!score) return reply.status(404).send({ error: "score_not_found" });
      return reply.send(score);
    }
  );
}
