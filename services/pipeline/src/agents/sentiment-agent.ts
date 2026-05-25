import type { AgentConfig, AgentResult, AgentTool } from "../lib/run-agent.js";
import { runAgent } from "../lib/run-agent.js";
import { MODELS, anthropic } from "../lib/anthropic.js";
import { fetchSportsNews } from "../tools/external-api-tools.js";
import { getSportSubredditPosts } from "../tools/reddit-tools.js";
import { getEspnInjuryReport } from "../tools/espn-tools.js";
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
              body:        { type: "string", description: "Reddit post body (alternative to description)" },
              publishedAt: { type: "string" },
              postedAt:    { type: "string", description: "Reddit timestamp (alternative to publishedAt)" },
              source:      { type: "string", description: "Source name e.g. 'ESPN' or 'r/nfl'" },
            },
          },
          description: "Array of news articles or Reddit posts to analyse",
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
    articles: Array<{ title?: string; description?: string; body?: string; publishedAt?: string; postedAt?: string; source?: string }>;
  }) => {
    if (!Array.isArray(articles) || !articles.length) return { score: null, reason: "no_articles" };

    const articleText = articles
      .slice(0, 15) // cap for token budget (increased since Reddit posts tend to be shorter)
      .map((a) => {
        const date = (a.publishedAt ?? a.postedAt ?? "").slice(0, 10);
        const text = a.description ?? a.body ?? "";
        const src  = a.source ? ` [${a.source}]` : "";
        return `[${date}]${src} ${a.title ?? ""}. ${text}`;
      })
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

2. For each team, gather intel from THREE sources (in priority order):

   SOURCE A — ESPN Official Injury Report (most authoritative):
   Call get_espn_injury_report with sport and teamName.
   This returns structured data: player name, status (Out/Doubtful/Questionable/Probable), injury type.
   Convert injury data into article-format items:
     title: "{Player} ({Position}) — {Status}: {Type}"
     body: "{Details if any}"
     postedAt: injury date or today
     source: "ESPN Official"

   SOURCE B — NewsAPI (context and narrative):
   Call fetch_sports_news with targeted queries (e.g. "Kansas City Chiefs injury report")
   This provides narrative context around the injuries.

   SOURCE C — Reddit sport subreddits (early intel, fan reaction):
   Use get_sport_subreddit_posts with the sport subreddit + team name query:
   - NFL teams  → subreddit: "nfl", query: "{team} injury"
   - NBA teams  → subreddit: "nba", query: "{team} injury lineup"
   - MLB teams  → subreddit: "baseball", query: "{team}"
   - NHL teams  → subreddit: "hockey", query: "{team} goalie"
   Fantasy subreddits (fantasyfootball/fantasybball/fantasybaseball/fantasyhockey) often
   surface injury news 30–60 min before ESPN updates.

3. Combine ALL items into a single array. Pass to analyse_articles_sentiment.

   InjuryConcern scoring guidance:
   - ESPN "Out" = very high (0.85-1.0)
   - ESPN "Doubtful" = high (0.65-0.85)
   - ESPN "Questionable" = moderate (0.35-0.65)
   - ESPN "Probable" or "Day-To-Day" = low (0.1-0.3)
   - No injuries on roster = 0.0

4. If score is not null, call write_sentiment_score with the entityId.

5. Summarise: entities scored, ESPN injuries found, average injuryConcern, notable findings.`;



export async function runSentimentAgent(): Promise<AgentResult> {
  const config: AgentConfig = {
    name:         "SentimentAgent",
    model:        MODELS.agent,
    systemPrompt: SYSTEM_PROMPT,
    tools: [
      getKeyPlayersForUpcomingGames,
      getEspnInjuryReport,    // primary: official ESPN injury data
      fetchSportsNews,        // secondary: news narrative context
      getSportSubredditPosts, // tertiary: early fan intel
      analyseArticlesSentiment,
      writeSentimentScore,
    ],
    maxIterations: 30,
  };

  return runAgent(config, `Run sentiment analysis now. UTC: ${new Date().toISOString()}`);
}
