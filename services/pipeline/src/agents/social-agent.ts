import type { AgentConfig, AgentResult, AgentTool } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS, anthropic } from "../lib/anthropic.js";
import { searchTwitterPicks, fetchAccountTimeline } from "../tools/external-api-tools.js";
import {
  getUpcomingGames,
  upsertSocialAccount,
  writeTrackedPick,
} from "../tools/db-tools.js";
import { db, schema } from "../lib/db.js";

// ─── Pick extraction tool (uses a fast Haiku call inline) ─────────────────────

const extractPickFromPost: AgentTool = {
  definition: {
    name: "extract_pick_from_post",
    description: "Use Claude to extract structured bet information from a social post. Returns null fields if no clear pick is found.",
    input_schema: {
      type: "object" as const,
      properties: {
        postText:  { type: "string", description: "Raw post text to analyse" },
        postUrl:   { type: "string" },
        authorHandle: { type: "string" },
        postedAt:  { type: "string", description: "ISO timestamp of post" },
      },
      required: ["postText", "postedAt"],
    },
  },
  execute: async ({ postText, postUrl, authorHandle, postedAt }: {
    postText: string; postUrl?: string; authorHandle?: string; postedAt: string;
  }) => {
    const response = await anthropic.messages.create({
      model: MODELS.agent,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: `You extract betting pick information from social posts. Return ONLY valid JSON, no markdown.
Schema: { "hasPick": boolean, "sport": string|null, "game": string|null, "betType": "spread"|"moneyline"|"total"|"prop"|"parlay"|null, "betLabel": string|null, "odds": number|null, "confidence": "lock"|"lean"|"play"|null }`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: `Post: ${postText}` },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      return JSON.parse(text);
    } catch {
      return { hasPick: false };
    }
  },
};

// ─── Monitored accounts tool ──────────────────────────────────────────────────

const getMonitoredAccounts: AgentTool = {
  definition: {
    name: "get_monitored_accounts",
    description: "Return the list of social accounts we actively monitor (all non-unverified tiers).",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" },
      },
      required: [],
    },
  },
  execute: async ({ limit = 50 }: { limit?: number }) => {
    const accounts = await db.query.socialAccounts.findMany({
      columns: { id: true, handle: true, platform: true, tier: true, followers: true },
      limit,
      orderBy: schema.socialAccounts.followers,
    });
    return accounts;
  },
};

// ─── Dedup tool — prevents writing picks we've already recorded ───────────────

const checkPickExists: AgentTool = {
  definition: {
    name: "check_pick_exists",
    description: "Check if a pick from this postUrl is already recorded. Always call before write_tracked_pick.",
    input_schema: {
      type: "object" as const,
      properties: {
        postUrl: { type: "string" },
      },
      required: ["postUrl"],
    },
  },
  execute: async ({ postUrl }: { postUrl: string }) => {
    const existing = await db.query.trackedPicks.findFirst({
      where: (t, { eq }) => eq(t.postUrl, postUrl),
      columns: { id: true },
    });
    return { exists: !!existing };
  },
};

// ─── Agent ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Social Scraper Agent for Sharp Edge.

Your job:
1. Call get_monitored_accounts — iterate their recent timelines via fetch_account_timeline
2. Call search_twitter_picks with hashtags for today's sports (e.g. "#NFLpicks", "#NBAPicksToday")
3. For each tweet found, call extract_pick_from_post
4. If hasPick=true AND confidence is not null:
   a. Call check_pick_exists (skip if already recorded)
   b. Call upsert_social_account to ensure the account exists in DB
   c. Call write_tracked_pick with the extracted data + IMMUTABLE postedAt timestamp
5. Summarise: posts scanned, picks extracted, new picks written, duplicates skipped

Important rules:
- NEVER modify postedAt — it must be the original tweet's created_at timestamp
- Skip picks with no betLabel (too vague to verify)
- Process monitored accounts first, then hashtag search`;

export async function runSocialAgent(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:         "SocialAgent",
    model:        MODELS.agent,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getMonitoredAccounts,
      fetchAccountTimeline,
      searchTwitterPicks,
      extractPickFromPost,
      checkPickExists,
      upsertSocialAccount,
      writeTrackedPick,
      getUpcomingGames,
    ],
    maxIterations: 40,
  };

  return runAgent(config, `Scrape social picks now. UTC: ${new Date().toISOString()}`);
}
