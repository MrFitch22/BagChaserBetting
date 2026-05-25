import type { AgentConfig, AgentResult, AgentTool } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS, anthropic } from "../lib/anthropic.js";
import { fetchSportsNews } from "../tools/external-api-tools.js";
import { getUpcomingGames, writeSentimentScore } from "../tools/db-tools.js";
import { db, schema } from "../lib/db.js";
import { inArray } from "drizzle-orm";

// ─── Batch sentiment analysis ─────────────────────────────────────────────────

const analyseArticlesSentiment: AgentTool = {
  definition: {
    name: "analyse_articles_sentiment",
    description: "Score sentiment for a batch of news articles about a specific player or team. Returns structured scores.",
    input_schema: {
      type: "object" as const,
      properties: {
        entityName: { type: "string", description: "Player or team name" },
        entityType: { type: "string", enum: ["player", "team"] },
        articles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title:       { type: "string" },
              description: { type: "string" },
              publishedAt: { type: "string" },
            },
          },
          description: "Array of news articles to analyse",
        },
      },
      required: ["entityName", "entityType", "articles"],
    },
  },
  execute: async ({
    entityName, entityType, articles,
  }: {
    entityName: string;
    entityType: string;
    articles: Array<{ title: string; description: string; publishedAt: string }>;
  }) => {
    if (!articles.length) return { score: null, reason: "no_articles" };

    const articleText = articles
      .slice(0, 10) // cap for token budget
      .map((a) => `[${a.publishedAt.slice(0, 10)}] ${a.title}. ${a.description ?? ""}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model:      MODELS.agent,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: `You analyse sports news sentiment for betting purposes. Return ONLY valid JSON:
{ "score": number, "injuryConcern": number, "motivation": number, "summary": string }
score: overall sentiment -1.0 (very negative) to 1.0 (very positive)
injuryConcern: 0.0 (healthy) to 1.0 (serious injury concern)
motivation: 0.0 (low) to 1.0 (highly motivated — revenge game, contract year, etc)
summary: 1-sentence explanation`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Entity: ${entityName} (${entityType})\n\nArticles:\n${articleText}`,
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
      return { score: null, error: "parse_failed" };
    }
  },
};

// ─── Players in upcoming games ────────────────────────────────────────────────

const getKeyPlayersForUpcomingGames: AgentTool = {
  definition: {
    name: "get_key_players_for_upcoming_games",
    description: "Return key players (starters, high-follower accounts) to generate news queries for.",
    input_schema: {
      type: "object" as const,
      properties: {
        hours: { type: "number", description: "Upcoming window in hours (default 24)" },
      },
      required: [],
    },
  },
  execute: async ({ hours = 24 }: { hours?: number }) => {
    // Return distinct teams in upcoming games so the agent can build news queries
    const now = new Date();
    const cutoff = new Date(now.getTime() + hours * 3_600_000);

    const upcomingGames = await db.query.games.findMany({
      where: (t, { and, gte, lte, inArray }) =>
        and(
          gte(t.gameTime, now.toISOString()),
          lte(t.gameTime, cutoff.toISOString()),
          inArray(t.status, ["scheduled", "live"])
        ),
      columns: { homeTeam: true, awayTeam: true, sport: true },
      limit: 20,
    });

    const teams = new Set<string>();
    for (const g of upcomingGames) {
      teams.add(`${g.homeTeam} ${g.sport}`);
      teams.add(`${g.awayTeam} ${g.sport}`);
    }

    return Array.from(teams).map((t) => ({ name: t.split(" ").slice(0, -1).join(" "), entityType: "team" }));
  },
};

const SYSTEM_PROMPT = `You are the Sentiment Agent for Sharp Edge.

Your job:
1. Call get_key_players_for_upcoming_games to get teams/players to research
2. For each entity, call fetch_sports_news with a targeted query (e.g. "Kansas City Chiefs injury report")
3. Call analyse_articles_sentiment with the returned articles
4. If score is not null, call write_sentiment_score with the entityId
   - For teams: use the team name as entityId (will be resolved later)
   - For players: use the player name as entityId
5. Summarise entities scored, average sentiment, notable findings

Keep queries specific. If no articles found, skip to next entity. Aim to cover all teams in upcoming 24h games.`;

export async function runSentimentAgent(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:         "SentimentAgent",
    model:        MODELS.agent,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getKeyPlayersForUpcomingGames,
      fetchSportsNews,
      analyseArticlesSentiment,
      writeSentimentScore,
    ],
    maxIterations: 30,
  };

  return runAgent(config, `Run sentiment analysis now. UTC: ${new Date().toISOString()}`);
}
