/**
 * Reddit API tools — public JSON endpoints, no auth required.
 * Feeds two signals:
 *   pickTracker — picks from r/sportsbook, r/sportsbetting, r/SharpSide
 *   sentiment   — team/player news from sport-specific subreddits
 */
import type { AgentTool } from "../lib/run-agent.js";

const REDDIT_BASE = "https://www.reddit.com";
const UA = "BagChaserBetting/1.0 (sports-betting intelligence; contact: support@bagchaser.com)";

// Subreddits used for pick extraction
export const PICK_SUBREDDITS = ["sportsbook", "sportsbetting", "gambling"] as const;

// Sport-specific subreddits for sentiment / injury intel
export const SPORT_SUBREDDITS: Record<string, string[]> = {
  NFL: ["nfl", "fantasyfootball", "NFLpickem"],
  NBA: ["nba", "nbadiscussion", "fantasybball"],
  MLB: ["baseball", "fantasybaseball"],
  NHL: ["hockey", "fantasyhockey"],
};

interface RedditPost {
  id:          string;
  subreddit:   string;
  title:       string;
  body:        string;
  author:      string;
  score:       number;
  url:         string;
  createdAt:   string;
  numComments: number;
}

interface RedditComment {
  id:        string;
  author:    string;
  body:      string;
  score:     number;
  createdAt: string;
}

async function redditFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${REDDIT_BASE}${path}`, {
    headers: {
      "User-Agent": UA,
      "Accept":     "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Reddit ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

function parsePost(child: unknown): RedditPost | null {
  const d = (child as { data: Record<string, unknown> }).data;
  if (!d || d["kind"] === "more") return null;
  return {
    id:          String(d["id"] ?? ""),
    subreddit:   String(d["subreddit"] ?? ""),
    title:       String(d["title"] ?? ""),
    body:        String(d["selftext"] ?? d["body"] ?? "").slice(0, 2000),
    author:      String(d["author"] ?? ""),
    score:       Number(d["score"] ?? 0),
    url:         `https://www.reddit.com${d["permalink"] ?? ""}`,
    createdAt:   new Date(Number(d["created_utc"] ?? 0) * 1000).toISOString(),
    numComments: Number(d["num_comments"] ?? 0),
  };
}

function parseComment(child: unknown): RedditComment | null {
  const d = (child as { kind: string; data: Record<string, unknown> });
  if (d.kind === "more" || !d.data?.body) return null;
  return {
    id:        String(d.data["id"] ?? ""),
    author:    String(d.data["author"] ?? ""),
    body:      String(d.data["body"] ?? "").slice(0, 1000),
    score:     Number(d.data["score"] ?? 0),
    createdAt: new Date(Number(d.data["created_utc"] ?? 0) * 1000).toISOString(),
  };
}

// ─── Tool: find & read today's Daily Discussion thread ────────────────────────
// r/sportsbook pins a "Daily Discussion" thread every day where users post picks.
// This is the highest-density source of structured betting picks on Reddit.

export const getDailyPicksThread: AgentTool = {
  definition: {
    name: "get_daily_picks_thread",
    description: `Find today's Daily Discussion/picks thread on r/sportsbook or r/sportsbetting and return the top comments. Comments often follow the format "TEAM LINE (ODDS) Xu" — highly structured picks. Returns up to 100 top-level comments sorted by score.`,
    input_schema: {
      type: "object" as const,
      properties: {
        subreddit: {
          type: "string",
          enum: ["sportsbook", "sportsbetting", "gambling"],
          description: "Which subreddit to search (default: sportsbook)",
        },
      },
      required: [],
    },
  },
  execute: async ({ subreddit = "sportsbook" }: { subreddit?: string }) => {
    // Search for today's daily thread
    const searchData = await redditFetch<{
      data: { children: unknown[] };
    }>(`/r/${subreddit}/search.json?q=Daily+Discussion&sort=new&t=day&limit=5&restrict_sr=1`);

    const posts = searchData.data.children
      .map(parsePost)
      .filter((p): p is RedditPost => p !== null);

    if (!posts.length) {
      return { found: false, message: "No daily thread found today" };
    }

    // Take the most recent thread
    const thread = posts[0]!;

    // Fetch comments
    const threadData = await redditFetch<[unknown, { data: { children: unknown[] } }]>(
      `/r/${subreddit}/comments/${thread.id}.json?sort=top&limit=100&depth=1`
    );

    const comments = threadData[1].data.children
      .map(parseComment)
      .filter((c): c is RedditComment => c !== null)
      .filter((c) => c.score > 0 && c.body.length > 10) // filter noise
      .slice(0, 100);

    return {
      found:       true,
      threadTitle: thread.title,
      threadUrl:   thread.url,
      postedAt:    thread.createdAt,
      commentCount: comments.length,
      comments:    comments.map((c) => ({
        text:      c.body,
        upvotes:   c.score,
        author:    c.author,
        postedAt:  c.createdAt,
        url:       `${thread.url}/${c.id}`,
      })),
    };
  },
};

// ─── Tool: search subreddit for picks related to a game ──────────────────────

export const searchRedditPicks: AgentTool = {
  definition: {
    name: "search_reddit_picks",
    description: "Search a betting subreddit for posts or comments about a specific game or team. Useful for finding picks when the daily thread approach misses something.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search terms e.g. 'Yankees Dodgers picks' or 'NBA picks tonight'",
        },
        subreddit: {
          type: "string",
          description: "Subreddit to search (default: sportsbook)",
        },
        limit: {
          type: "number",
          description: "Max results (default 25, max 50)",
        },
      },
      required: ["query"],
    },
  },
  execute: async ({ query, subreddit = "sportsbook", limit = 25 }: {
    query: string; subreddit?: string; limit?: number;
  }) => {
    const encoded = encodeURIComponent(query);
    const data = await redditFetch<{ data: { children: unknown[] } }>(
      `/r/${subreddit}/search.json?q=${encoded}&sort=new&t=day&limit=${Math.min(limit, 50)}&restrict_sr=1`
    );

    return data.data.children
      .map(parsePost)
      .filter((p): p is RedditPost => p !== null)
      .map((p) => ({
        title:    p.title,
        body:     p.body.slice(0, 500),
        author:   p.author,
        upvotes:  p.score,
        postedAt: p.createdAt,
        url:      p.url,
      }));
  },
};

// ─── Tool: get sport subreddit posts for sentiment ────────────────────────────
// Pulls top/new posts from sport-specific subreddits to feed the sentiment signal.
// r/nfl surfaces injury reports fast. r/nba has player news. r/hockey confirms goalies.

export const getSportSubredditPosts: AgentTool = {
  definition: {
    name: "get_sport_subreddit_posts",
    description: `Fetch recent top posts from a sport-specific subreddit for sentiment and injury intelligence. Use for the teams in upcoming games.

Sport → subreddits available:
- NFL  → nfl, fantasyfootball
- NBA  → nba, nbadiscussion, fantasybball
- MLB  → baseball, fantasybaseball
- NHL  → hockey, fantasyhockey

Fantasy subreddits are gold for early injury intel — fantasy players obsess over player health before mainstream media.`,
    input_schema: {
      type: "object" as const,
      properties: {
        subreddit: {
          type: "string",
          description: "Subreddit name (without r/)",
        },
        query: {
          type: "string",
          description: "Optional search query e.g. team name or player name. Omit to get top new posts.",
        },
        limit: {
          type: "number",
          description: "Max posts (default 20)",
        },
      },
      required: ["subreddit"],
    },
  },
  execute: async ({ subreddit, query, limit = 20 }: {
    subreddit: string; query?: string; limit?: number;
  }) => {
    let path: string;

    if (query) {
      const encoded = encodeURIComponent(query);
      path = `/r/${subreddit}/search.json?q=${encoded}&sort=new&t=day&limit=${Math.min(limit, 50)}&restrict_sr=1`;
    } else {
      path = `/r/${subreddit}/new.json?limit=${Math.min(limit, 50)}`;
    }

    const data = await redditFetch<{ data: { children: unknown[] } }>(path);

    return data.data.children
      .map(parsePost)
      .filter((p): p is RedditPost => p !== null)
      .filter((p) => p.score >= 0) // include new posts with no votes yet
      .map((p) => ({
        title:    p.title,
        body:     p.body.slice(0, 600),
        upvotes:  p.score,
        postedAt: p.createdAt,
        url:      p.url,
        comments: p.numComments,
      }));
  },
};

// ─── Tool: get sharp discussion posts ────────────────────────────────────────
// r/sportsbook + r/gambling have analytical bettors discussing CLV and edges.
// r/SharpSide was banned — replaced with r/gambling which has sharper discourse.

export const getSharpDiscussion: AgentTool = {
  definition: {
    name: "get_sharp_discussion",
    description: "Fetch top posts from betting subreddits focused on sharp/analytical bettors — line value, CLV, and edge discussion. Pulls from r/sportsbook (new) and r/gambling.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max posts per subreddit (default 10)" },
      },
      required: [],
    },
  },
  execute: async ({ limit = 10 }: { limit?: number }) => {
    const cap = Math.min(limit, 20);
    const results: unknown[] = [];

    for (const sub of ["sportsbook", "gambling"] as const) {
      try {
        const data = await redditFetch<{ data: { children: unknown[] } }>(
          `/r/${sub}/new.json?limit=${cap}`
        );
        const posts = data.data.children
          .map(parsePost)
          .filter((p): p is RedditPost => p !== null)
          .map((p) => ({
            subreddit: p.subreddit,
            title:     p.title,
            body:      p.body.slice(0, 800),
            upvotes:   p.score,
            postedAt:  p.createdAt,
            url:       p.url,
          }));
        results.push(...posts);
      } catch {
        // subreddit unavailable — skip
      }
    }

    return results;
  },
};
