import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import type { UserTier } from "@sharp-edge/shared";

const TIER_ORDER: UserTier[] = ["free", "pro", "sharp"];

export function requireTier(minTier: "pro" | "sharp") {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, request.auth.userId),
      columns: { tier: true },
    });

    if (!user) {
      return reply.status(401).send({ error: "user_not_found" });
    }

    const userTierIndex = TIER_ORDER.indexOf(user.tier as UserTier);
    const requiredIndex = TIER_ORDER.indexOf(minTier);

    if (userTierIndex < requiredIndex) {
      return reply.status(403).send({
        error: "upgrade_required",
        requiredTier: minTier,
        currentTier: user.tier,
      });
    }
  };
}
