import type { AgentConfig, AgentResult } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS } from "../lib/anthropic.js";
import {
  fetchOddsForSport,
  fetchHistoricalOddsMovement,
} from "../tools/external-api-tools.js";
import { getEspnScoreboard, getEspnGameOdds } from "../tools/espn-tools.js";
import { getUpcomingGames, upsertGame, writeOddsBatch } from "../tools/db-tools.js";

// Sharp move detection runs in the agent loop — it needs state across tool calls
// so we pass a small in-memory map as closure context rather than a DB tool
import type { AgentTool } from "../lib/run-agent.js";
import { Redis } from "@upstash/redis";

const isUpstash = process.env["REDIS_URL"]?.startsWith("https://");

const redis = isUpstash
  ? new Redis({ url: process.env["REDIS_URL"]!, token: process.env["REDIS_TOKEN"] ?? "" })
  : { get: async () => null, setex: async () => "OK" } as unknown as Redis;

const API_URL = process.env["API_URL"] ?? "http://localhost:3001";

async function postSharpAlert(payload: object) {
  try {
    await fetch(`${API_URL}/internal/sharp-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { /* API may not be running */ }
}

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

    await redis.setex(cacheKey, 21_600, JSON.stringify({ price: newPrice, point: newPoint ?? null }));

    if (isSharpMove && prior) {
      await postSharpAlert({
        gameId, market, label: label ?? "",
        priceBefore: prior.price, priceAfter: newPrice,
        books: [book], detectedAt: new Date().toISOString(),
      });
    }

    return { priorPrice: prior?.price ?? null, priceDelta, pointDelta, isSignificant, isSharpMove };
  },
};

const SYSTEM_PROMPT = `You are the Odds Ingestion Agent for Sharp Edge, a sports betting analytics platform.

Your job (complete ALL steps efficiently):

1. Call get_upcoming_games to see what games need fresh odds (next 48 hours)

2. For each SPORT with upcoming games, call fetch_odds_for_sport ONCE (covers all games for that sport).
   Call all sports IN PARALLEL — one tool call per sport in the same message.
   Sports: NFL=americanfootball_nfl, NBA=basketball_nba, MLB=baseball_mlb, NHL=icehockey_nhl

3. For every game returned, call upsert_game (batch these in parallel too — one call per game).

4. For every odds line in every game, call detect_and_cache_line_movement.
   CRITICAL: Call as many as possible IN PARALLEL — do NOT call them one at a time.
   Process ALL lines for ALL books for ALL games in as few message turns as possible.
   Each call is cheap and independent — parallelize aggressively.

5. Collect all results where isSignificant=true. Call write_odds_batch ONCE with all of them.

6. Summarise: sports covered, games processed, total lines checked, significant movements written, sharp moves flagged.

Rules:
- Parallel tool calls are free — use them. Never wait for one line before checking the next.
- Skip ESPN enrichment unless you finish steps 1-5 with iterations to spare.
- If odds API key missing or returns error, note it and finish gracefully.`;


export async function runOddsAgent(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:       "OddsAgent",
    model:      MODELS.agent,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getUpcomingGames,
      fetchOddsForSport,
      fetchHistoricalOddsMovement,
      getEspnScoreboard,   // cross-reference game status + ESPN BET odds
      getEspnGameOdds,     // deep ESPN BET/Caesars/DK odds per event
      upsertGame,
      detectAndCacheLineMovement,
      writeOddsBatch,
    ],
    maxIterations: 60,
  };

  return runAgent(config, `Run odds ingestion now. Current UTC time: ${new Date().toISOString()}`);
}
