/**
 * LangGraph pipeline orchestration.
 *
 * Replaces the Claude-as-orchestrator pattern with a deterministic StateGraph.
 * Each agent runs as an independent node — no LLM needed to decide what to run.
 *
 * Graph topology (each cycle):
 *
 *   START
 *     └─► load_state
 *           ├─► odds_node       ──┐
 *           ├─► social_node     ──┤
 *           ├─► verify_node     ──┼─► score_confidence ─► summarize ─► END
 *           ├─► sentiment_node  ──┤
 *           └─► scraper_node    ──┘   (scraper only every 6h)
 *
 * Conditional routing: each agent node only runs if its condition is met,
 * otherwise it short-circuits to "skip" (no-op). This is determined in
 * load_state and checked via conditional edges.
 *
 * Benefits over Claude orchestrator:
 *   - Zero tokens spent deciding what to run
 *   - True parallel agent execution
 *   - LangSmith traces for full observability
 *   - Per-node retry/error handling
 *   - Deterministic, auditable scheduling
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { PipelineState } from "./state.js";
import type { PipelineStateType } from "./state.js";
import { db, schema } from "../lib/db.js";
import { eq, gte, count } from "drizzle-orm";

// Lazy imports to avoid circular issues and allow env loading first
async function importAgents() {
  const [
    { runOddsAgent },
    { runSocialAgent },
    { runVerificationAgent },
    { runSentimentAgent },
    { runAllScrapers },
    { runConfidenceScorer },
  ] = await Promise.all([
    import("../agents/odds-agent.js"),
    import("../agents/social-agent.js"),
    import("../agents/verification-agent.js"),
    import("../agents/sentiment-agent.js"),
    import("../scrapers/index.js"),
    import("../score-confidence.js"),
  ]);
  return { runOddsAgent, runSocialAgent, runVerificationAgent, runSentimentAgent, runAllScrapers, runConfidenceScorer };
}

// ─── Node: load_state ─────────────────────────────────────────────────────────
// Reads DB state and sets flags that drive conditional routing.

async function loadStateNode(_state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const now = new Date();
  const hourUTC = now.getUTCHours();

  // 11am–3am UTC covers all US game windows (ET prime time + late West Coast)
  const isGameHours = hourUTC >= 11 || hourUTC <= 3;

  const [pendingResult, gamesResult] = await Promise.all([
    db.select({ count: count() })
      .from(schema.trackedPicks)
      .where(eq(schema.trackedPicks.result, "pending")),
    db.select({ count: count() })
      .from(schema.games)
      .where(gte(schema.games.gameTime, now.toISOString())),
  ]);

  const pendingPicks  = Number(pendingResult[0]?.count ?? 0);
  const upcomingGames = Number(gamesResult[0]?.count ?? 0);

  console.log(`[Graph] State — hour=${hourUTC}UTC isGame=${isGameHours} pending=${pendingPicks} upcoming=${upcomingGames}`);

  return { utcHour: hourUTC, isGameHours, pendingPicks, upcomingGames };
}

// ─── Node: odds_node ──────────────────────────────────────────────────────────

async function oddsNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  if (state.upcomingGames === 0) {
    return { results: { odds: "skipped — no upcoming games" } };
  }
  try {
    const { runOddsAgent } = await importAgents();
    const result = await runOddsAgent();
    return { results: { odds: result.summary.slice(0, 300) } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [`odds: ${msg}`], results: { odds: `error: ${msg}` } };
  }
}

// ─── Node: social_node ────────────────────────────────────────────────────────
// Run in morning (7–16 UTC) and once during game hours

async function socialNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const shouldRun = (state.utcHour >= 7 && state.utcHour <= 16) || state.isGameHours;
  if (!shouldRun) {
    return { results: { social: "skipped — outside social scrape window" } };
  }
  try {
    const { runSocialAgent } = await importAgents();
    const result = await runSocialAgent();
    return { results: { social: result.summary.slice(0, 300) } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [`social: ${msg}`], results: { social: `error: ${msg}` } };
  }
}

// ─── Node: verify_node ────────────────────────────────────────────────────────

async function verifyNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  if (state.pendingPicks === 0) {
    return { results: { verify: "skipped — no pending picks" } };
  }
  try {
    const { runVerificationAgent } = await importAgents();
    const result = await runVerificationAgent();
    return { results: { verify: result.summary.slice(0, 300) } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [`verify: ${msg}`], results: { verify: `error: ${msg}` } };
  }
}

// ─── Node: sentiment_node ─────────────────────────────────────────────────────
// Morning only (8–15 UTC) — once per day is enough for sentiment

async function sentimentNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const shouldRun = state.utcHour >= 8 && state.utcHour <= 15 && state.upcomingGames > 0;
  if (!shouldRun) {
    return { results: { sentiment: "skipped" } };
  }
  try {
    const { runSentimentAgent } = await importAgents();
    const result = await runSentimentAgent();
    return { results: { sentiment: result.summary.slice(0, 300) } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [`sentiment: ${msg}`], results: { sentiment: `error: ${msg}` } };
  }
}

// ─── Node: scraper_node ───────────────────────────────────────────────────────
// Every 6 hours (UTC 0, 6, 12, 18 ±1h window)

async function scraperNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  const sixHourMarks = [0, 6, 12, 18];
  const shouldRun = sixHourMarks.some((h) => Math.abs(state.utcHour - h) <= 1);
  if (!shouldRun) {
    return { results: { scrapers: "skipped — not a 6h mark" } };
  }
  try {
    const { runAllScrapers } = await importAgents();
    await runAllScrapers(db);
    return { results: { scrapers: "complete" } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [`scrapers: ${msg}`], results: { scrapers: `error: ${msg}` } };
  }
}

// ─── Node: score_confidence ───────────────────────────────────────────────────
// Runs after ALL parallel agent nodes complete.
// Always runs if there are upcoming games — this is what generates the edges.

async function scoreConfidenceNode(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  if (state.upcomingGames === 0) {
    return { results: { scorer: "skipped — no upcoming games" } };
  }
  try {
    const { runConfidenceScorer } = await importAgents();
    const result = await runConfidenceScorer();
    return {
      results: {
        scorer: `scored ${result.scored} edges across ${result.gamesProcessed} games, ${result.narrativesGenerated} narratives`,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { errors: [`scorer: ${msg}`], results: { scorer: `error: ${msg}` } };
  }
}

// ─── Node: summarize ─────────────────────────────────────────────────────────

function summarizeNode(state: PipelineStateType): Partial<PipelineStateType> {
  const lines = Object.entries(state.results).map(([k, v]) => `  ${k}: ${v}`);
  console.log(`[Graph] Cycle complete:\n${lines.join("\n")}`);
  if (state.errors.length > 0) {
    console.error(`[Graph] Errors:\n${state.errors.map((e) => `  ${e}`).join("\n")}`);
  }
  return {};
}

// ─── Build graph ──────────────────────────────────────────────────────────────

const graph = new StateGraph(PipelineState)
  .addNode("load_state",        loadStateNode)
  .addNode("odds_node",         oddsNode)
  .addNode("social_node",       socialNode)
  .addNode("verify_node",       verifyNode)
  .addNode("sentiment_node",    sentimentNode)
  .addNode("scraper_node",      scraperNode)
  .addNode("score_confidence",  scoreConfidenceNode)
  .addNode("summarize",         summarizeNode)

  // load_state fans out to all agent nodes in parallel
  .addEdge(START,         "load_state")
  .addEdge("load_state",  "odds_node")
  .addEdge("load_state",  "social_node")
  .addEdge("load_state",  "verify_node")
  .addEdge("load_state",  "sentiment_node")
  .addEdge("load_state",  "scraper_node")

  // All agent nodes converge to score_confidence, which waits for all of them
  .addEdge("odds_node",       "score_confidence")
  .addEdge("social_node",     "score_confidence")
  .addEdge("verify_node",     "score_confidence")
  .addEdge("sentiment_node",  "score_confidence")
  .addEdge("scraper_node",    "score_confidence")

  // score_confidence → summarize → END
  .addEdge("score_confidence", "summarize")
  .addEdge("summarize",        END);

export const pipelineGraph = graph.compile();

// ─── Runner ───────────────────────────────────────────────────────────────────

export interface GraphCycleResult {
  results:   Record<string, string>;
  errors:    string[];
  durationMs: number;
}

export async function runPipelineGraph(): Promise<GraphCycleResult> {
  const start = Date.now();

  const finalState = await pipelineGraph.invoke({});

  return {
    results:    finalState.results,
    errors:     finalState.errors,
    durationMs: Date.now() - start,
  };
}
