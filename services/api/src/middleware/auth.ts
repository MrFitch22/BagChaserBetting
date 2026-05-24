import type { FastifyRequest, FastifyReply } from "fastify";
import { clerkClient } from "@clerk/fastify";

declare module "fastify" {
  interface FastifyRequest {
    auth: {
      userId: string;
      sessionId: string;
    };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const session = await clerkClient.sessions.verifySession(token, token);
    request.auth = { userId: session.userId, sessionId: session.id };
  } catch {
    return reply.status(401).send({ error: "unauthorized" });
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const session = await clerkClient.sessions.verifySession(token, token);
      request.auth = { userId: session.userId, sessionId: session.id };
    }
  } catch {
    // unauthenticated request — continue
  }
}
