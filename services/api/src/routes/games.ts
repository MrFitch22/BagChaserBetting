import type { FastifyInstance } from "fastify";
import { eq, gte, lte, and, desc, inArray, sql } from "drizzle-orm";
import { trackedPicks } from "../db/schema.js";
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

  // GET /api/scores/top-edges — today's top confidence scores as EdgeCard[] (Pro+)
  app.get(
    "/scores/top-edges",
    { preHandler: [requireTier("pro")] },
    async (_request, reply) => {
      const cacheKey = "scores:top-edges";
      const cached = await redis.get(cacheKey);
      if (cached) return reply.send(cached);

      const now = new Date();
      const cutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const rows = await db
        .select({ score: confidenceScores, game: games })
        .from(confidenceScores)
        .innerJoin(games, eq(confidenceScores.gameId, games.id))
        .where(
          and(
            gte(games.gameTime, now.toISOString()),
            lte(games.gameTime, cutoff.toISOString()),
            gte(confidenceScores.score, "55")
          )
        )
        .orderBy(desc(confidenceScores.score))
        .limit(20);

      if (!rows.length) return reply.send([]);

      // Fetch the latest odds for each game so EdgeCard has a real price
      const gameIds = [...new Set(rows.map((r) => r.game.id))];
      const latestOdds = await db
        .select()
        .from(oddsHistory)
        .where(
          and(
            inArray(oddsHistory.gameId, gameIds),
            gte(oddsHistory.capturedAt, new Date(Date.now() - 60 * 60 * 1000).toISOString())
          )
        )
        .orderBy(desc(oddsHistory.capturedAt));

      // Build a lookup: gameId + market + label → best price (prefer Pinnacle, else first)
      const oddsMap = new Map<string, number>();
      for (const o of latestOdds) {
        const key = `${o.gameId}:${o.market}:${o.label ?? ""}`;
        if (!oddsMap.has(key) || o.book === "pinnacle") {
          oddsMap.set(key, o.price);
        }
      }

      const edgeCards = rows.map(({ score, game }) => {
        const oddsKey = `${game.id}:${score.market}:${score.label}`;
        return {
          gameId:        game.id,
          sport:         game.sport,
          homeTeam:      game.homeTeam,
          awayTeam:      game.awayTeam,
          gameTime:      game.gameTime,
          market:        score.market,
          label:         score.label,
          odds:          oddsMap.get(oddsKey) ?? -110,
          confidence: {
            id:           score.id,
            gameId:       game.id,
            market:       score.market,
            label:        score.label,
            score:        parseFloat(score.score),
            signals: {
              playerTrend:  parseFloat(score.playerTrend  ?? "50"),
              sharpMoney:   parseFloat(score.sharpMoney   ?? "0"),
              sentiment:    parseFloat(score.sentiment    ?? "50"),
              scheduleEdge: parseFloat(score.scheduleEdge ?? "50"),
              pickTracker:  parseFloat(score.pickTracker  ?? "50"),
              matchup:      parseFloat(score.scheduleEdge ?? "50"),
            },
            modelVersion: score.modelVersion ?? "v1-odds",
            computedAt:   score.computedAt,
          },
          isSharpMove:    Math.abs(parseFloat(score.sharpMoney ?? "0")) >= 30,
          sharpDirection: null,
        };
      });

      await redis.setex(cacheKey, CACHE_TTL.confidence, JSON.stringify(edgeCards));
      return reply.send(edgeCards);
    }
  );

  // GET /api/scores/today-record — win/loss record for today's tracked picks
  app.get("/scores/today-record", async (_request, reply) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const picks = await db.query.trackedPicks.findMany({
      where: and(
        gte(trackedPicks.postedAt, startOfDay.toISOString()),
        sql`${trackedPicks.result} != 'pending'`
      ),
      columns: { result: true, unitsReturned: true },
    });

    const record = picks.reduce(
      (acc, p) => {
        if (p.result === "win")  acc.wins++;
        else if (p.result === "loss") acc.losses++;
        else if (p.result === "push") acc.pushes++;
        acc.units += parseFloat(p.unitsReturned ?? "0");
        return acc;
      },
      { wins: 0, losses: 0, pushes: 0, units: 0 }
    );

    return reply.send({ ...record, units: parseFloat(record.units.toFixed(2)) });
  });

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
