import type { FastifyInstance } from "fastify";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { socialAccounts, trackedPicks } from "../db/schema.js";
import { redis, CACHE_TTL } from "../db/redis.js";
import { requireAuth } from "../middleware/auth.js";

export async function sellersRoutes(app: FastifyInstance) {
  // GET /api/sellers — leaderboard
  app.get("/sellers", async (request, reply) => {
    const query = request.query as {
      platform?: string;
      sport?: string;
      tier?: string;
      limit?: string;
      offset?: string;
    };

    const limit = Math.min(parseInt(query.limit ?? "50"), 100);
    const offset = parseInt(query.offset ?? "0");
    const cacheKey = `sellers:leaderboard:${JSON.stringify(query)}`;

    const cached = await redis.get(cacheKey);
    if (cached) return reply.send(cached);

    const rows = await db.query.socialAccounts.findMany({
      where: query.tier ? eq(socialAccounts.tier, query.tier) : undefined,
      orderBy: [desc(socialAccounts.verifiedRoi)],
      limit,
      offset,
    });

    await redis.setex(cacheKey, CACHE_TTL.leaderboard, JSON.stringify(rows));
    return reply.send(rows);
  });

  // GET /api/sellers/fraud-alerts
  app.get("/sellers/fraud-alerts", async (_request, reply) => {
    const alerts = await db.query.socialAccounts.findMany({
      where: eq(socialAccounts.isFraud, true),
      orderBy: desc(socialAccounts.trackingSince),
      limit: 20,
    });
    return reply.send(alerts);
  });

  // GET /api/sellers/:handle — seller profile
  app.get<{ Params: { handle: string } }>("/sellers/:handle", async (request, reply) => {
    const { handle } = request.params;
    const platform = (request.query as { platform?: string }).platform ?? "twitter";

    const account = await db.query.socialAccounts.findFirst({
      where: and(eq(socialAccounts.handle, handle), eq(socialAccounts.platform, platform)),
    });

    if (!account) return reply.status(404).send({ error: "seller_not_found" });

    return reply.send(account);
  });

  // GET /api/sellers/:handle/picks — verified pick history
  app.get<{ Params: { handle: string } }>("/sellers/:handle/picks", async (request, reply) => {
    const { handle } = request.params;
    const query = request.query as { platform?: string; limit?: string; cursor?: string };
    const platform = query.platform ?? "twitter";
    const limit = Math.min(parseInt(query.limit ?? "20"), 50);

    const account = await db.query.socialAccounts.findFirst({
      where: and(eq(socialAccounts.handle, handle), eq(socialAccounts.platform, platform)),
      columns: { id: true },
    });

    if (!account) return reply.status(404).send({ error: "seller_not_found" });

    const picks = await db.query.trackedPicks.findMany({
      where: eq(trackedPicks.accountId, account.id),
      orderBy: desc(trackedPicks.postedAt),
      limit: limit + 1,
    });

    const hasMore = picks.length > limit;
    const results = hasMore ? picks.slice(0, limit) : picks;
    const nextCursor = hasMore ? results[results.length - 1]?.id : null;

    return reply.send({ picks: results, nextCursor, total: results.length });
  });

  // GET /api/sellers/:handle/badge — embeddable trust badge data
  app.get<{ Params: { handle: string } }>("/sellers/:handle/badge", async (request, reply) => {
    const { handle } = request.params;
    const platform = (request.query as { platform?: string }).platform ?? "twitter";

    const account = await db.query.socialAccounts.findFirst({
      where: and(eq(socialAccounts.handle, handle), eq(socialAccounts.platform, platform)),
      columns: {
        handle: true,
        platform: true,
        tier: true,
        trustScore: true,
        verifiedW: true,
        verifiedL: true,
        verifiedRoi: true,
        isFraud: true,
      },
    });

    if (!account) return reply.status(404).send({ error: "seller_not_found" });

    reply.header("Cache-Control", "public, max-age=300");
    return reply.send(account);
  });
}
