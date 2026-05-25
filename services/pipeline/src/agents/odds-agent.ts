import type { AgentConfig, AgentResult } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS } from "../lib/anthropic.js";
import {
  fetchOddsForSport,
  fetchHistoricalOddsMovement,
} from "../tools/external-api-tools.js";
import { getUpcomingGames, upsertGame, writeOddsBatch } from "../tools/db-tools.js";

// Sharp move detection runs in the agent loop — it needs state across tool calls
// so we pass a small in-memory map as closure context rather than a DB tool
import type { AgentTool } from "../lib/run-agent.js";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env["REDIS_URL"] ?? "",
  token: process.env["REDIS_TOKEN"] ?? "",
});

/** Checks prior cached odds and emits a flag if the line moved significantly */
const detectAndCacheLineMovement: AgentTool = {
  definition: {
    name: "detect_and_cache_line_movement",
    description: "Compare new odds to last cached odds for a game. Returns movement data and caches the new odds. Call this for every game+market+book combo after fetching fresh odds.",
    input_schema: {
      type: "object" as const,
      properties: {
        gameId:     { type: "string" },
        book:       { type: "string" },
        market:     { type: "string" },
        label:      { type: "string" },
        newPrice:   { type: "number", description: "New American odds" },
        newPoint:   { type: "number" },
      },
      required: ["gameId", "book", "market", "newPrice"],
    },
  },
  execute: async ({
    gameId, book, market, label, newPrice, newPoint,
  }: {
    gameId: string; book: string; market: string;
    label?: string; newPrice: number; newPoint?: number;
  }) => {
    const cacheKey = `odds:${gameId}:${book}:${market}:${label ?? ""}`;
    const prior = await redis.get<{ price: number; point: number | null }>(cacheKey);

    const priceDelta  = prior ? newPrice - prior.price : 0;
    const pointDelta  = prior && newPoint != null && prior.point != null
      ? newPoint - prior.point : 0;
    const isSignificant = Math.abs(priceDelta) >= 5 || Math.abs(pointDelta) >= 0.5;
    const isSharpMove   = Math.abs(priceDelta) >= 15 || Math.abs(pointDelta) >= 1.5;

    // Cache for 6 hours
    await redis.setex(cacheKey, 21_600, JSON.stringify({ price: newPrice, point: newPoint ?? null }));

    return { priorPrice: prior?.price ?? null, priceDelta, pointDelta, isSignificant, isSharpMove };
  },
};

const SYSTEM_PROMPT = `You are the Odds Ingestion Agent for Sharp Edge, a sports betting analytics platform.

Your job is to:
1. Call get_upcoming_games to see what games need fresh odds (next 48 hours)
2. For each sport with upcoming games, call fetch_odds_for_sport
3. For every game returned, call upsert_game to keep the games table current
4. For every odds line, call detect_and_cache_line_movement — only write to DB if isSignificant=true
5. Call write_odds_batch with all significant movements (batching is critical for performance)
6. Summarise: how many games processed, how many odds records written, how many sharp moves flagged

Sports to cover: NFL (americanfootball_nfl), NBA (basketball_nba), MLB (baseball_mlb), NHL (icehockey_nhl)

Be efficient — batch your writes. If the odds API key is missing or returns an error, note it and finish gracefully.`;

export async function runOddsAgent(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:       "OddsAgent",
    model:      MODELS.agent,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getUpcomingGames,
      fetchOddsForSport,
      fetchHistoricalOddsMovement,
      upsertGame,
      detectAndCacheLineMovement,
      writeOddsBatch,
    ],
    maxIterations: 30,
  };

  return runAgent(config, `Run odds ingestion now. Current UTC time: ${new Date().toISOString()}`);
}
