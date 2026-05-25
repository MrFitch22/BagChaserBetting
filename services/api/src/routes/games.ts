import type { FastifyInstance } from "fastify";
import { eq, gte, lte, and, desc, inArray, sql } from "drizzle-orm";
import { trackedPicks } from "../db/schema.js";
import { db } from "../db/client.js";
import { games, oddsHistory, confidenceScores } from "../db/schema.js";
import { redis, CACHE_TTL } from "../db/redis.js";
import { optionalAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier.js";

const BOOK_ORDER = ["pinnacle", "draftkings", "fanduel", "betmgm", "caesars", "pointsbet", "bet365"];

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
              sharpMoney:   parseFloat(score.sharpMoney   ?? "50"),
              lineMovement: parseFloat((score as { lineMovement?: string | null }).lineMovement ?? "50"),
              matchup:      parseFloat(score.matchup      ?? "50"),
              publicMoney:  parseFloat((score as { publicMoney?: string | null }).publicMoney  ?? "50"),
              sentiment:    parseFloat(score.sentiment    ?? "50"),
              playerTrend:  parseFloat(score.playerTrend  ?? "50"),
              pickTracker:  parseFloat(score.pickTracker  ?? "50"),
              scheduleEdge: parseFloat(score.scheduleEdge ?? "50"),
            },
            dataQuality:  parseFloat((score as { dataQuality?: string | null }).dataQuality ?? "0"),
            modelVersion: score.modelVersion ?? "v3-dynamic",
            computedAt:   score.computedAt,
            narrative:    (score as { narrative?: string | null }).narrative ?? null,
          },
          isSharpMove:    parseFloat(score.sharpMoney ?? "50") >= 70 &&
                          parseFloat((score as { lineMovement?: string | null }).lineMovement ?? "50") >= 60,
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

  // GET /api/line-shopping — current odds across all books for upcoming games
  app.get("/line-shopping", async (_request, reply) => {
    const cacheKey = "line-shopping:current";
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(cached);

    const now      = new Date();
    const cutoff   = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const freshCut = new Date(now.getTime() - 30 * 60 * 1000); // last 30 min

    const upcomingGames = await db.query.games.findMany({
      where: and(gte(games.gameTime, now.toISOString()), lte(games.gameTime, cutoff.toISOString())),
      orderBy: games.gameTime,
      limit: 30,
    });

    if (!upcomingGames.length) return reply.send([]);

    const gameIds = upcomingGames.map((g) => g.id);

    const recentOdds = await db
      .select()
      .from(oddsHistory)
      .where(and(
        inArray(oddsHistory.gameId, gameIds),
        gte(oddsHistory.capturedAt, freshCut.toISOString()),
        eq(oddsHistory.isOpening, false),
      ))
      .orderBy(desc(oddsHistory.capturedAt));

    // Build: gameId → market → label → book → best price
    type BookEntry = { book: string; price: number; point: number | null };
    const tree = new Map<string, Map<string, Map<string, Map<string, BookEntry>>>>();

    for (const o of recentOdds) {
      if (!o.gameId || !o.label) continue;
      if (!tree.has(o.gameId))  tree.set(o.gameId, new Map());
      const byMarket = tree.get(o.gameId)!;
      if (!byMarket.has(o.market))  byMarket.set(o.market, new Map());
      const byLabel = byMarket.get(o.market)!;
      if (!byLabel.has(o.label))    byLabel.set(o.label, new Map());
      const byBook = byLabel.get(o.label)!;
      // Keep only the most recent entry per book (odds are ordered desc by capturedAt)
      if (!byBook.has(o.book)) {
        byBook.set(o.book, { book: o.book, price: o.price, point: o.point ? parseFloat(o.point) : null });
      }
    }

    const result = upcomingGames.map((game) => {
      const byMarket = tree.get(game.id);
      if (!byMarket) return null;

      const markets = [...byMarket.entries()].map(([market, byLabel]) => {
        const lines = [...byLabel.entries()].map(([label, byBook]) => {
          const books = BOOK_ORDER
            .map((b) => byBook.get(b))
            .filter((b): b is BookEntry => b !== undefined);

          // Also include any books not in BOOK_ORDER
          for (const [bk, entry] of byBook.entries()) {
            if (!BOOK_ORDER.includes(bk)) books.push(entry);
          }

          // Best price: most positive (or least negative) American odds
          const bestEntry = books.reduce(
            (best, b) => b.price > best.price ? b : best,
            books[0]!
          );

          return { label, books, bestPrice: bestEntry.price, bestBook: bestEntry.book };
        });

        return { market, lines };
      });

      return {
        gameId:   game.id,
        sport:    game.sport,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        gameTime: game.gameTime,
        markets,
      };
    }).filter(Boolean);

    await redis.setex(cacheKey, 120, JSON.stringify(result)); // 2-min cache (odds move fast)
    return reply.send(result);
  });
}
