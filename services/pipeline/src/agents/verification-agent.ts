import type { AgentConfig, AgentResult, AgentTool } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS, anthropic } from "../lib/anthropic.js";
import { fetchGameResult } from "../tools/external-api-tools.js";
import { getEspnGameResult, getEspnScoreboard } from "../tools/espn-tools.js";
import {
  getPendingPicks,
  updatePickResult,
  recalculateAccountStats,
} from "../tools/db-tools.js";

// ─── Pick verdict tool ────────────────────────────────────────────────────────

const determinePickResult: AgentTool = {
  definition: {
    name: "determine_pick_result",
    description: "Given a bet label, the final score, and home/away teams, determine if the pick won, lost, or pushed. Uses Claude to handle ambiguous prop or parlays.",
    input_schema: {
      type: "object" as const,
      properties: {
        betLabel:  { type: "string", description: "e.g. 'Chiefs -6.5', 'Over 48.5', 'Mahomes 2+ TDs'" },
        betType:   { type: "string" },
        homeTeam:  { type: "string" },
        awayTeam:  { type: "string" },
        homeScore: { type: "number" },
        awayScore: { type: "number" },
        oddsAtPost: { type: "number" },
      },
      required: ["betLabel", "homeTeam", "awayTeam", "homeScore", "awayScore"],
    },
  },
  execute: async ({
    betLabel, betType, homeTeam, awayTeam, homeScore, awayScore, oddsAtPost,
  }: {
    betLabel: string; betType?: string; homeTeam: string; awayTeam: string;
    homeScore: number; awayScore: number; oddsAtPost?: number;
  }) => {
    // Fast inline Claude call to resolve the verdict
    const response = await anthropic.messages.create({
      model:      MODELS.agent,
      max_tokens: 256,
      system: [
        {
          type: "text",
          text: `You determine sports bet outcomes. Return ONLY valid JSON: { "result": "win"|"loss"|"push", "unitsReturned": number, "closingOdds": number|null, "clv": number|null }
unitsReturned: for win with American odds, compute profit per 1 unit wagered. For loss return -1. For push return 0.
clv: if closingOdds and oddsAtPost known, compute (implied(oddsAtPost) - implied(closingOdds)) * 100. Otherwise null.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Bet: "${betLabel}" (${betType ?? "unknown"})
${awayTeam} @ ${homeTeam}: final score ${awayScore}-${homeScore}
Odds at post: ${oddsAtPost ?? "unknown"}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      return JSON.parse(text);
    } catch {
      // If parsing fails, return unknown — don't guess
      return { result: null, error: "parse_failed" };
    }
  },
};

// ─── Batch account refresh ────────────────────────────────────────────────────

const batchRecalculateAccounts: AgentTool = {
  definition: {
    name: "batch_recalculate_accounts",
    description: "Recalculate stats for multiple accounts at once. Call this after processing a batch of picks.",
    input_schema: {
      type: "object" as const,
      properties: {
        accountIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of account UUIDs to recalculate",
        },
      },
      required: ["accountIds"],
    },
  },
  execute: async ({ accountIds }: { accountIds: string[] }) => {
    const results = await Promise.all(
      accountIds.map((id) => recalculateAccountStats.execute({ accountId: id }))
    );
    return { updated: accountIds.length, results };
  },
};

// ─── Agent ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Verification Agent for Sharp Edge.

Your job:
1. Call get_pending_picks — get all picks awaiting a result

2. For each pending pick, look up the game result:
   PRIMARY: Call get_espn_game_result with the sport and homeTeam/awayTeam names.
   - If the game is completed (completed=true), use the score.
   - If the game is in progress (status="in"), skip it — come back next cycle.
   - If not found by team names, try get_espn_scoreboard to browse all games for that sport.
   FALLBACK: If ESPN doesn't return a result, call fetch_game_result with the externalId.

3. Once you have homeScore and awayScore for a completed game:
   a. Call determine_pick_result with the bet details and final score
   b. If result is not null, call update_pick_result

4. Collect all accountIds that had picks updated (deduplicate)
5. Call batch_recalculate_accounts with those IDs
6. Report: picks verified, wins/losses/pushes, accounts updated

Rules:
- Skip games that are not yet final (status="pre" or "in")
- ESPN data is authoritative — use it over DB status fields
- Be methodical — fully process one pick before moving to the next`;


export async function runVerificationAgent(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:         "VerificationAgent",
    model:        MODELS.agent,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getPendingPicks,
      getEspnGameResult,
      getEspnScoreboard,
      fetchGameResult,       // fallback
      determinePickResult,
      updatePickResult,
      batchRecalculateAccounts,
    ],
    maxIterations: 50,
  };

  return runAgent(config, `Verify pending picks now. UTC: ${new Date().toISOString()}`);
}
