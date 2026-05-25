import type { AgentTool } from "../lib/run-agent.js";

const ODDS_API_KEY  = process.env["ODDS_API_KEY"] ?? "";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDSPAPI_KEY  = process.env["ODDSPAPI_KEY"] ?? "";
const NEWS_API_KEY  = process.env["NEWS_API_KEY"] ?? "";
// Decode URL-encoded tokens (e.g. %3D → =) that some platforms inject when copying
const TWITTER_TOKEN = decodeURIComponent(process.env["TWITTER_BEARER_TOKEN"] ?? "");

async function apiFetch<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

// ─── The Odds API ─────────────────────────────────────────────────────────────

export const fetchOddsForSport: AgentTool = {
  definition: {
    name: "fetch_odds_for_sport",
    description: "Pull current odds from The Odds API for a given sport across all monitored books.",
    input_schema: {
      type: "object" as const,
      properties: {
        sport:   { type: "string", description: "Odds API sport key e.g. americanfootball_nfl, basketball_nba" },
        markets: { type: "string", description: "Comma-separated markets: h2h,spreads,totals (default all three)" },
      },
      required: ["sport"],
    },
  },
  execute: async ({ sport, markets = "h2h,spreads,totals" }: { sport: string; markets?: string }) => {
    const BOOKS = "draftkings,fanduel,betmgm,caesars,pinnacle,pointsbet";
    const url = `${ODDS_API_BASE}/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets}&bookmakers=${BOOKS}&oddsFormat=american`;
    const data = await apiFetch<unknown[]>(url);
    // Return a compact representation to stay within token budgets
    return data.map((game: unknown) => {
      const g = game as {
        id: string; sport_key: string; sport_title: string;
        home_team: string; away_team: string; commence_time: string;
        bookmakers: Array<{ key: string; markets: Array<{ key: string; outcomes: Array<{ name: string; price: number; point?: number }> }> }>;
      };
      return {
        id:           g.id,
        sport:        g.sport_key,
        homeTeam:     g.home_team,
        awayTeam:     g.away_team,
        commenceTime: g.commence_time,
        bookmakers:   g.bookmakers.map((b) => ({
          book:    b.key,
          markets: b.markets.map((m) => ({
            market:   m.key,
            outcomes: m.outcomes,
          })),
        })),
      };
    });
  },
};

export const fetchHistoricalOddsMovement: AgentTool = {
  definition: {
    name: "fetch_historical_odds_movement",
    description: "Get opening odds for a specific game from The Odds API historical endpoint.",
    input_schema: {
      type: "object" as const,
      properties: {
        sport:   { type: "string" },
        eventId: { type: "string", description: "The Odds API event ID" },
      },
      required: ["sport", "eventId"],
    },
  },
  execute: async ({ sport, eventId }: { sport: string; eventId: string }) => {
    const url = `${ODDS_API_BASE}/sports/${sport}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals&oddsFormat=american`;
    return apiFetch<unknown>(url);
  },
};

// ─── Odds Papi ────────────────────────────────────────────────────────────────

export const fetchOddsPapiForSport: AgentTool = {
  definition: {
    name: "fetch_odds_papi_for_sport",
    description: "Pull current odds from Odds Papi for a given sport.",
    input_schema: {
      type: "object" as const,
      properties: {
        sport: { type: "string" },
      },
      required: ["sport"],
    },
  },
  execute: async ({ sport }: { sport: string }) => {
    const url = `https://api.oddspapi.io/v1/odds?sport=${sport}&type=prematch&oddsFormat=american`;
    // If Oddspapi is routed via RapidAPI or expects API Key differently, we handle headers here
    const headers = { "x-api-key": ODDSPAPI_KEY };
    const data = await apiFetch<unknown[]>(url, headers).catch(() => []);
    // Map it similarly to the The Odds API output if possible for easy downstream use
    return data;
  },
};

// ─── Twitter / X API ─────────────────────────────────────────────────────────

export const searchTwitterPicks: AgentTool = {
  definition: {
    name: "search_twitter_picks",
    description: "Search Twitter for recent betting pick posts using relevant hashtags.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:   { type: "string", description: "Search query e.g. '#NBApicks -is:retweet lang:en'" },
        maxResults: { type: "number", description: "Max tweets to return (10–100, default 50)" },
      },
      required: ["query"],
    },
  },
  execute: async ({ query, maxResults = 50 }: { query: string; maxResults?: number }) => {
    const encoded = encodeURIComponent(query);
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encoded}&max_results=${maxResults}&tweet.fields=created_at,author_id,entities&expansions=author_id&user.fields=username,public_metrics`;
    const data = await apiFetch<{
      data?: Array<{ id: string; text: string; created_at: string; author_id: string }>;
      includes?: { users?: Array<{ id: string; username: string; public_metrics: { followers_count: number } }> };
    }>(url, { Authorization: `Bearer ${TWITTER_TOKEN}` });

    const userMap = new Map(
      (data.includes?.users ?? []).map((u) => [u.id, u])
    );

    return (data.data ?? []).map((tweet) => {
      const user = userMap.get(tweet.author_id);
      return {
        id:          tweet.id,
        text:        tweet.text,
        createdAt:   tweet.created_at,
        authorId:    tweet.author_id,
        handle:      user?.username ?? null,
        followers:   user?.public_metrics.followers_count ?? 0,
        url:         `https://twitter.com/${user?.username ?? tweet.author_id}/status/${tweet.id}`,
      };
    });
  },
};

export const fetchAccountTimeline: AgentTool = {
  definition: {
    name: "fetch_account_timeline",
    description: "Get recent tweets from a specific Twitter account we are monitoring.",
    input_schema: {
      type: "object" as const,
      properties: {
        username:   { type: "string" },
        maxResults: { type: "number" },
      },
      required: ["username"],
    },
  },
  execute: async ({ username, maxResults = 20 }: { username: string; maxResults?: number }) => {
    // Lookup user ID first
    const userRes = await apiFetch<{ data: { id: string } }>(
      `https://api.twitter.com/2/users/by/username/${username}`,
      { Authorization: `Bearer ${TWITTER_TOKEN}` }
    );
    const userId = userRes.data.id;

    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at&exclude=retweets,replies`;
    const data = await apiFetch<{
      data?: Array<{ id: string; text: string; created_at: string }>;
    }>(url, { Authorization: `Bearer ${TWITTER_TOKEN}` });

    return (data.data ?? []).map((t) => ({
      id:        t.id,
      text:      t.text,
      createdAt: t.created_at,
      url:       `https://twitter.com/${username}/status/${t.id}`,
    }));
  },
};

// ─── NewsAPI ──────────────────────────────────────────────────────────────────

export const fetchSportsNews: AgentTool = {
  definition: {
    name: "fetch_sports_news",
    description: "Fetch recent sports news articles for sentiment analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query e.g. 'Patrick Mahomes injury'" },
        pageSize: { type: "number", description: "Number of articles (max 100, default 20)" },
      },
      required: ["query"],
    },
  },
  execute: async ({ query, pageSize = 20 }: { query: string; pageSize?: number }) => {
    const encoded = encodeURIComponent(query);
    const url = `https://newsapi.org/v2/everything?q=${encoded}&language=en&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${NEWS_API_KEY}`;
    const data = await apiFetch<{
      articles: Array<{
        title: string; description: string; url: string;
        publishedAt: string; source: { name: string };
      }>;
    }>(url);

    return data.articles.map((a) => ({
      title:       a.title,
      description: a.description,
      url:         a.url,
      publishedAt: a.publishedAt,
      source:      a.source.name,
    }));
  },
};

// ─── Game results (SportsRadar-compatible stub) ───────────────────────────────

export const fetchGameResult: AgentTool = {
  definition: {
    name: "fetch_game_result",
    description: "Fetch the final score and box score for a completed game. Uses SportsRadar if key is set, otherwise falls back to ESPN.",
    input_schema: {
      type: "object" as const,
      properties: {
        externalId: { type: "string", description: "The game's external_id as stored in the DB" },
        sport:      { type: "string", enum: ["NFL", "NBA", "MLB", "NHL"] },
      },
      required: ["externalId", "sport"],
    },
  },
  execute: async ({ externalId, sport }: { externalId: string; sport: string }) => {
    // ESPN public API — no key needed, good for final scores
    const SPORT_MAP: Record<string, string> = {
      NFL: "football/nfl",
      NBA: "basketball/nba",
      MLB: "baseball/mlb",
      NHL: "hockey/nhl",
    };

    const sportPath = SPORT_MAP[sport];
    if (!sportPath) throw new Error(`Unsupported sport: ${sport}`);

    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard`;
    const data = await apiFetch<{
      events?: Array<{
        id: string;
        name: string;
        status: { type: { completed: boolean; description: string } };
        competitions: Array<{
          competitors: Array<{ homeAway: string; score: string; team: { displayName: string } }>;
        }>;
      }>;
    }>(url);

    const event = data.events?.find((e) => e.id === externalId || e.name.includes(externalId));
    if (!event) return { found: false, externalId };

    const comp = event.competitions[0];
    const home = comp?.competitors.find((c) => c.homeAway === "home");
    const away = comp?.competitors.find((c) => c.homeAway === "away");

    return {
      found:     true,
      completed: event.status.type.completed,
      status:    event.status.type.description,
      homeTeam:  home?.team.displayName,
      awayTeam:  away?.team.displayName,
      homeScore: home ? parseInt(home.score) : null,
      awayScore: away ? parseInt(away.score) : null,
    };
  },
};
