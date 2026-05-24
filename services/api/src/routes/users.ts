import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, affiliateClicks } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export async function usersRoutes(app: FastifyInstance) {
  // GET /api/users/me
  app.get("/users/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, request.auth.userId),
    });

    if (!user) return reply.status(404).send({ error: "user_not_found" });
    return reply.send(user);
  });

  // POST /api/affiliate/click — log affiliate click + return deep-link
  app.post("/affiliate/click", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { sportsbook: string; parlayId?: string };

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, request.auth.userId),
      columns: { id: true },
    });

    if (!user) return reply.status(401).send({ error: "user_not_found" });

    await db.insert(affiliateClicks).values({
      userId: user.id,
      sportsbook: body.sportsbook,
      parlayId: body.parlayId,
    });

    // Deep link construction — affiliate params loaded from env
    const affiliateIds: Record<string, string | undefined> = {
      draftkings: process.env["DRAFTKINGS_AFFILIATE_ID"],
      fanduel:    process.env["FANDUEL_AFFILIATE_ID"],
      betmgm:     process.env["BETMGM_AFFILIATE_ID"],
    };

    const baseUrls: Record<string, string> = {
      draftkings: "https://sportsbook.draftkings.com/",
      fanduel:    "https://www.fanduel.com/sportsbook",
      betmgm:     "https://sports.betmgm.com/",
    };

    const affiliateId = affiliateIds[body.sportsbook];
    const baseUrl = baseUrls[body.sportsbook] ?? `https://${body.sportsbook}.com`;
    const deepLink = affiliateId ? `${baseUrl}?ref=${affiliateId}` : baseUrl;

    return reply.send({ deepLink });
  });
}
