import type { Server } from "socket.io";
import { db } from "../db/client.js";
import { redis } from "../db/redis.js";
import { games } from "../db/schema.js";
import { eq } from "drizzle-orm";

export function registerLiveGamesSocket(io: Server) {
  const liveGames = io.of("/live");

  liveGames.on("connection", (socket) => {
    socket.on("subscribe:game", async (gameId: string) => {
      socket.join(`game:${gameId}`);

      // Send current game state immediately
      const cached = await redis.get(`game:${gameId}:live`);
      if (cached) {
        socket.emit("game:state", cached);
      }
    });

    socket.on("unsubscribe:game", (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });

    socket.on("subscribe:parlay", (parlayId: string) => {
      socket.join(`parlay:${parlayId}`);
    });
  });

  return {
    pushScoreUpdate(gameId: string, update: {
      homeScore: number;
      awayScore: number;
      status: string;
      period?: number;
      timeRemaining?: string;
    }) {
      liveGames.to(`game:${gameId}`).emit("game:score", { gameId, ...update });
      redis.setex(`game:${gameId}:live`, 60, JSON.stringify(update));
    },

    pushOddsUpdate(gameId: string, odds: unknown) {
      liveGames.to(`game:${gameId}`).emit("odds:update", { gameId, odds });
    },

    pushSharpAlert(alert: {
      gameId: string;
      market: string;
      label: string;
      direction: string;
      books: string[];
    }) {
      liveGames.emit("sharp:alert", alert);
    },

    pushParlayProbability(parlayId: string, probability: number, legs: unknown[]) {
      liveGames.to(`parlay:${parlayId}`).emit("parlay:probability", {
        parlayId,
        probability,
        legs,
      });
    },
  };
}
