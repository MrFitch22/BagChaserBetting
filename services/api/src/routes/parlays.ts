import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { userParlays, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import { requireTier } from "../middleware/tier.js";
import { americanToImplied } from "@sharp-edge/shared";

const ParlayLegSchema = z.object({
  gameId: z.string().uuid(),
  market: z.enum(["spread", "moneyline", "total", "prop"]),
  label: z.string(),
  odds: z.number().int(),
  point: z.number().nullable(),
});

const ParlayRequestSchema = z.object({
  legs: z.array(ParlayLegSchema).min(2).max(12),
});

async function fetchConfidenceScore(gameId: string, market: string): Promise<number> {
  // Returns 50 (neutral) when no score available yet
  try {
    const score = await db.query.confidenceScores.findFirst({
      where: (t, { and, eq }) => and(eq(t.gameId, gameId), eq(t.market, market)),
      columns: { score: true },
      orderBy: (t, { desc }) => [desc(t.computedAt)],
    });
    return score ? parseFloat(score.score) : 50;
  } catch {
    return 50;
  }
}

export async function parlaysRoutes(app: FastifyInstance) {
  // POST /api/parlays/probability — compute adjusted probability
  app.post(
    "/parlays/probability",
    { preHandler: [requireAuth, requireTier("pro")] },
    async (request, reply) => {
      const parsed = ParlayRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error });

      const { legs } = parsed.data;

      let adjustedCombined = 1.0;
      let bookCombined = 1.0;

      const enrichedLegs = await Promise.all(
        legs.map(async (leg) => {
          const confidence = await fetchConfidenceScore(leg.gameId, leg.market);
          const rawImplied = americanToImplied(leg.odds);
          const adjustment = (confidence - 50) * 0.003; // ±15% max
          const adjustedProb = Math.max(0.05, Math.min(0.95, rawImplied + adjustment));

          adjustedCombined *= adjustedProb;
          bookCombined *= rawImplied;

          return { ...leg, adjustedProbability: adjustedProb, bookImpliedProbability: rawImplied };
        })
      );

      // Payout odds from book's combined implied
      const payoutOdds =
        bookCombined < 0.5
          ? Math.round((1 / bookCombined - 1) * 100)
          : -Math.round((bookCombined / (1 - bookCombined)) * 100);

      const edgeScore = (adjustedCombined - bookCombined) * 100;
      const expectedValue = adjustedCombined * payoutOdds - (1 - adjustedCombined) * 100;

      return reply.send({
        legs: enrichedLegs,
        adjustedProbability: adjustedCombined,
        bookImpliedProbability: bookCombined,
        edgeScore,
        payoutOdds,
        expectedValue,
      });
    }
  );

  // POST /api/parlays — save parlay to user account
  app.post(
    "/parlays",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = request.body as {
        legs: unknown[];
        combinedProb?: number;
        bookImplied?: number;
        edgeScore?: number;
        payoutOdds?: number;
        sportsbook?: string;
      };

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, request.auth.userId),
        columns: { id: true },
      });

      if (!user) return reply.status(401).send({ error: "user_not_found" });

      const [parlay] = await db
        .insert(userParlays)
        .values({
          userId: user.id,
          legs: body.legs,
          combinedProb: body.combinedProb?.toString(),
          bookImplied: body.bookImplied?.toString(),
          edgeScore: body.edgeScore?.toString(),
          payoutOdds: body.payoutOdds,
          sportsbook: body.sportsbook,
        })
        .returning();

      return reply.status(201).send(parlay);
    }
  );

  // GET /api/parlays — user's saved parlays
  app.get("/parlays", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, request.auth.userId),
      columns: { id: true },
    });

    if (!user) return reply.status(401).send({ error: "user_not_found" });

    const parlays = await db.query.userParlays.findMany({
      where: eq(userParlays.userId, user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 50,
    });

    return reply.send(parlays);
  });
}
