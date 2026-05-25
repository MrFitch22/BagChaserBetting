import { Redis } from "@upstash/redis";

// Upstash uses HTTPS REST; a plain redis:// URL means local dev — use a no-op cache
const isUpstash = process.env["REDIS_URL"]?.startsWith("https://");

interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  setex(key: string, seconds: number, value: string | number | object): Promise<string | null>;
}

const devNoop: RedisLike = {
  get: async () => null,
  setex: async () => null,
};

export const redis: RedisLike = isUpstash
  ? new Redis({ url: process.env["REDIS_URL"]!, token: process.env["REDIS_TOKEN"] ?? "" })
  : devNoop;

export const CACHE_TTL = {
  odds: 300,         // 5 minutes
  confidence: 300,   // 5 minutes
  leaderboard: 600,  // 10 minutes
  game: 60,          // 1 minute (live games)
} as const;
