import type { AgentConfig, AgentResult, AgentTool } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS } from "../lib/anthropic.js";
import { runOddsAgent } from "./odds-agent.js";
import { runSocialAgent } from "./social-agent.js";
import { runVerificationAgent } from "./verification-agent.js";
import { runSentimentAgent } from "./sentiment-agent.js";
import { runAllScrapers } from "../scrapers/index.js";
import { db, schema } from "../lib/db.js";
import { eq, gte, count } from "drizzle-orm";

// ─── State-reading tools for the orchestrator ─────────────────────────────────

const getPipelineState: AgentTool = {
  definition: {
    name: "get_pipeline_state",
    description: "Return the current state of the pipeline: pending picks count, upcoming games today, and last run timestamps for each sub-agent.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  execute: async () => {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [pendingPicksResult, todayGamesResult] = await Promise.all([
      db.select({ count: count() })
        .from(schema.trackedPicks)
        .where(eq(schema.trackedPicks.result, "pending")),
      db.select({ count: count() })
        .from(schema.games)
        .where(gte(schema.games.gameTime, now.toISOString())),
    ]);

    const hourUTC = now.getUTCHours();
    const isGameHours = hourUTC >= 11 && hourUTC <= 3; // 11am–3am UTC covers US game times

    return {
      utcTime:         now.toISOString(),
      hourUTC,
      isGameHours,
      pendingPicks:    pendingPicksResult[0]?.count ?? 0,
      upcomingGames:   todayGamesResult[0]?.count ?? 0,
      dayOfWeek:       now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    };
  },
};

// ─── Sub-agent launcher tools ─────────────────────────────────────────────────
// The orchestrator calls these as tools — each one runs the full sub-agent.
// We run whichever agents the orchestrator selects in parallel.

const runOddsIngestion: AgentTool = {
  definition: {
    name: "run_odds_ingestion",
    description: "Run the Odds Ingestion Agent: fetches current lines from The Odds API and writes significant movements to the DB.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  execute: async () => runOddsAgent(),
};

const runSocialScrape: AgentTool = {
  definition: {
    name: "run_social_scrape",
    description: "Run the Social Scraper Agent: scans Twitter for pick posts and extracts structured bet data.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  execute: async () => runSocialAgent(),
};

const runPickVerification: AgentTool = {
  definition: {
    name: "run_pick_verification",
    description: "Run the Verification Agent: resolves all pending picks against final game scores.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  execute: async () => runVerificationAgent(),
};

const runSentimentAnalysis: AgentTool = {
  definition: {
    name: "run_sentiment_analysis",
    description: "Run the Sentiment Agent: fetches sports news and scores player/team sentiment for upcoming games.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  execute: async () => runSentimentAgent(),
};

const runScrapers: AgentTool = {
  definition: {
    name: "run_scrapers",
    description: "Run all web scrapers: public betting % from Action Network, sportsbook promotions (DraftKings/FanDuel/BetMGM/Caesars/HardRock), and casino promotions.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  execute: async () => { await runAllScrapers(db); return { status: "scrapers complete" }; },
};

// ─── Orchestrator system prompt ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Pipeline Orchestrator for Sharp Edge, a sports betting analytics platform.

You decide which sub-agents to run each cycle based on current platform state. Here are the rules:

**Odds Ingestion** (run_odds_ingestion):
- Run every cycle when upcomingGames > 0
- During game hours (isGameHours=true), this is the highest priority

**Pick Verification** (run_pick_verification):
- Run every cycle when pendingPicks > 0
- Always run after game hours end (hourUTC 3-11) to catch overnight results

**Social Scrape** (run_social_scrape):
- Run every other cycle during game hours
- Run once during morning hours (hourUTC 12-16 UTC / 7-11am ET)

**Sentiment Analysis** (run_sentiment_analysis):
- Run once in the morning (hourUTC 10-14) ahead of the day's games
- Only run if upcomingGames > 0

**Scrapers** (run_scrapers):
- Run once every 6 hours (hourUTC 0, 6, 12, 18)
- Fetches public betting %, sportsbook promos, and casino promos

Execution rules:
1. Call get_pipeline_state first
2. Decide which agents to run (can be multiple)
3. Call their tool functions — they will run IN PARALLEL automatically
4. Report what ran, key outcomes from each agent's summary, and what to prioritize next cycle

Be decisive. When in doubt, run odds ingestion — fresh lines are always valuable.`;

// ─── Main orchestrator run ────────────────────────────────────────────────────

export async function runOrchestrator(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:         "Orchestrator",
    model:        MODELS.orchestrator,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getPipelineState,
      runOddsIngestion,
      runSocialScrape,
      runPickVerification,
      runSentimentAnalysis,
      runScrapers,
    ],
    maxIterations: 10, // Orchestrator should be decisive, not verbose
  };

  return runAgent(config, `Run pipeline cycle. UTC: ${new Date().toISOString()}`);
}
