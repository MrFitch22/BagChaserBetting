import { Redis } from "@upstash/redis";

if (!process.env["REDIS_URL"]) {
  throw new Error("REDIS_URL is required");
}

export const redis = new Redis({
  url: process.env["REDIS_URL"],
  token: process.env["REDIS_TOKEN"] ?? "",
});

export const CACHE_TTL = {
  odds: 300,         // 5 minutes
  confidence: 300,   // 5 minutes
  leaderboard: 600,  // 10 minutes
  game: 60,          // 1 minute (live games)
} as const;
