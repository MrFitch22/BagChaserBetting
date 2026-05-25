import type { FastifyInstance } from "fastify";
import { desc, eq, gte, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { bookPromos, casinoPromos, publicBettingData } from "../db/schema.js";
import { redis, CACHE_TTL } from "../db/redis.js";

export async function promosRoutes(app: FastifyInstance) {
  // GET /api/promos/books — latest sportsbook promotions
  app.get("/promos/books", async (_request, reply) => {
    const cacheKey = "promos:books";
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(cached);

    const rows = await db.query.bookPromos.findMany({
      where: gte(bookPromos.capturedAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      orderBy: desc(bookPromos.capturedAt),
      limit: 100,
    });

    // Deduplicate by book + title, keep latest
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const key = `${r.book}:${r.title.toLowerCase().slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await redis.setex(cacheKey, CACHE_TTL.confidence, JSON.stringify(deduped));
    return reply.send(deduped);
  });

  // GET /api/promos/books/:book — promos for a specific book
  app.get<{ Params: { book: string } }>("/promos/books/:book", async (request, reply) => {
    const { book } = request.params;

    const rows = await db.query.bookPromos.findMany({
      where: and(
        eq(bookPromos.book, book),
        gte(bookPromos.capturedAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ),
      orderBy: desc(bookPromos.capturedAt),
      limit: 20,
    });

    return reply.send(rows);
  });

  // GET /api/promos/casinos — latest casino promotions
  app.get("/promos/casinos", async (_request, reply) => {
    const cacheKey = "promos:casinos";
    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(cached);

    const rows = await db.query.casinoPromos.findMany({
      where: gte(casinoPromos.capturedAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      orderBy: desc(casinoPromos.capturedAt),
      limit: 100,
    });

    // Deduplicate by casino + title
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const key = `${r.casino}:${r.title.toLowerCase().slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await redis.setex(cacheKey, CACHE_TTL.confidence, JSON.stringify(deduped));
    return reply.send(deduped);
  });

  // GET /api/public-betting/:gameId — public betting % for a game
  app.get<{ Params: { gameId: string } }>("/public-betting/:gameId", async (request, reply) => {
    const { gameId } = request.params;

    const rows = await db.query.publicBettingData.findMany({
      where: and(
        eq(publicBettingData.gameId, gameId),
        gte(publicBettingData.capturedAt, new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      ),
      orderBy: desc(publicBettingData.capturedAt),
    });

    // Latest snapshot per market+label
    const latest = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      const key = `${row.market}:${row.label}`;
      if (!latest.has(key)) latest.set(key, row);
    }

    return reply.send([...latest.values()]);
  });
}
