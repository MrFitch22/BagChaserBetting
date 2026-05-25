/**
 * ESPN-backed AgentTools.
 *
 * Plugs into:
 *   - VerificationAgent  → get_espn_game_result
 *   - SentimentAgent     → get_espn_injury_report
 *   - OddsAgent          → get_espn_game_odds
 *   - ConfidenceScorer   → ESPN win probability (direct client calls)
 */
import type { AgentTool } from "../lib/run-agent.js";
import {
  ESPN_SPORT_MAP,
  findGame,
  getScoreboard,
  getGameSummary,
  getLeagueInjuries,
  getGameOdds,
} from "../clients/espn-client.js";

// ─── Tool: get game result by team names ──────────────────────────────────────
// Replaces fetchGameResult (ESPN scoreboard search). Works even without externalId.

export const getEspnGameResult: AgentTool = {
  definition: {
    name: "get_espn_game_result",
    description: `Fetch the current score and status of a game from ESPN. Works for in-progress and completed games.
Returns homeScore, awayScore, status (scheduled/in-progress/final), and win probability if live.
Use this to verify if a game is done and what the final score was.`,
    input_schema: {
      type: "object" as const,
      properties: {
        sport:    { type: "string", enum: ["NFL", "NBA", "MLB", "NHL"], description: "Sport code" },
        homeTeam: { type: "string", description: "Home team name e.g. 'Kansas City Chiefs'" },
        awayTeam: { type: "string", description: "Away team name e.g. 'Philadelphia Eagles'" },
        espnEventId: { type: "string", description: "ESPN event ID if known — faster lookup, skips search" },
        date:     { type: "string", description: "Date YYYY-MM-DD (defaults to today)" },
      },
      required: ["sport"],
    },
  },
  execute: async ({ sport, homeTeam, awayTeam, espnEventId, date }: {
    sport: string; homeTeam?: string; awayTeam?: string; espnEventId?: string; date?: string;
  }) => {
    const map = ESPN_SPORT_MAP[sport];
    if (!map) return { found: false, error: `Unknown sport: ${sport}` };

    let game = null;

    if (espnEventId) {
      // Direct scoreboard lookup for today, find by ID
      const games = await getScoreboard(map.sport, map.league, date);
      game = games.find((g) => g.id === espnEventId) ?? null;
    } else if (homeTeam && awayTeam) {
      game = await findGame(map.sport, map.league, homeTeam, awayTeam, date);
    } else {
      return { found: false, error: "Provide espnEventId OR both homeTeam and awayTeam" };
    }

    if (!game) return { found: false };

    return {
      found:       true,
      espnEventId: game.id,
      homeTeam:    game.homeTeam.displayName,
      awayTeam:    game.awayTeam.displayName,
      homeScore:   game.homeTeam.score,
      awayScore:   game.awayTeam.score,
      status:      game.status.type.state,      // "pre" | "in" | "post"
      completed:   game.status.type.completed,
      description: game.status.type.description, // "Final", "Halftime", "4th Quarter", etc.
      period:      game.status.period,
      clock:       game.status.displayClock,
      winProbability: game.winProbability,
      date:        game.date,
    };
  },
};

// ─── Tool: get game score by ESPN event ID (deep summary) ─────────────────────
// For when we have the ESPN event ID and want full odds + injuries too

export const getEspnGameSummary: AgentTool = {
  definition: {
    name: "get_espn_game_summary",
    description: "Deep game data including win probability, odds from multiple providers, and in-game injuries. Use when you have the ESPN event ID from a prior get_espn_game_result call.",
    input_schema: {
      type: "object" as const,
      properties: {
        sport:       { type: "string", enum: ["NFL", "NBA", "MLB", "NHL"] },
        espnEventId: { type: "string", description: "ESPN event ID" },
      },
      required: ["sport", "espnEventId"],
    },
  },
  execute: async ({ sport, espnEventId }: { sport: string; espnEventId: string }) => {
    const map = ESPN_SPORT_MAP[sport];
    if (!map) return { error: `Unknown sport: ${sport}` };
    return getGameSummary(map.sport, map.league, espnEventId);
  },
};

// ─── Tool: get today's scoreboard for a sport ─────────────────────────────────

export const getEspnScoreboard: AgentTool = {
  definition: {
    name: "get_espn_scoreboard",
    description: "Get all games for a sport today (or a specific date). Returns scores, status, and odds for each game. Use to check which games are live, upcoming, or final.",
    input_schema: {
      type: "object" as const,
      properties: {
        sport: { type: "string", enum: ["NFL", "NBA", "MLB", "NHL"] },
        date:  { type: "string", description: "Date YYYY-MM-DD (optional, defaults to today)" },
      },
      required: ["sport"],
    },
  },
  execute: async ({ sport, date }: { sport: string; date?: string }) => {
    const map = ESPN_SPORT_MAP[sport];
    if (!map) return { error: `Unknown sport: ${sport}` };

    const games = await getScoreboard(map.sport, map.league, date);
    return games.map((g) => ({
      espnEventId: g.id,
      shortName:   g.shortName,
      date:        g.date,
      status:      g.status.type.state,
      description: g.status.type.description,
      completed:   g.status.type.completed,
      homeTeam:    g.homeTeam.displayName,
      awayTeam:    g.awayTeam.displayName,
      homeScore:   g.homeTeam.score,
      awayScore:   g.awayTeam.score,
      odds:        g.odds,
    }));
  },
};

// ─── Tool: get injury report for a sport/team ─────────────────────────────────
// This is the key upgrade for the sentiment agent: structured official ESPN injury data
// instead of trying to parse Reddit posts.

export const getEspnInjuryReport: AgentTool = {
  definition: {
    name: "get_espn_injury_report",
    description: `Get the official ESPN injury report for a sport. Returns all active injuries with:
- Player name, position, jersey number
- Team name
- Status: "Out", "Doubtful", "Questionable", "Probable", "Day-To-Day"
- Injury type (e.g. "Knee", "Hamstring") and detail
- Date of injury

This is authoritative structured data — more reliable than parsing Reddit/news.
Filter by teamName client-side to get injuries for a specific team.`,
    input_schema: {
      type: "object" as const,
      properties: {
        sport:    { type: "string", enum: ["NFL", "NBA", "MLB", "NHL"] },
        teamName: { type: "string", description: "Optional: filter to injuries for this team only" },
      },
      required: ["sport"],
    },
  },
  execute: async ({ sport, teamName }: { sport: string; teamName?: string }) => {
    const map = ESPN_SPORT_MAP[sport];
    if (!map) return { error: `Unknown sport: ${sport}` };

    const injuries = await getLeagueInjuries(map.sport, map.league);

    const filtered = teamName
      ? injuries.filter((inj) =>
          inj.team.displayName.toLowerCase().includes(teamName.toLowerCase())
        )
      : injuries;

    // Group by team for readability
    const byTeam = new Map<string, typeof filtered>();
    for (const inj of filtered) {
      const key = inj.team.displayName;
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(inj);
    }

    return {
      totalInjuries: filtered.length,
      teams: Array.from(byTeam.entries()).map(([team, injs]) => ({
        team,
        injuries: injs.map((inj) => ({
          player:   inj.athlete.displayName,
          position: inj.athlete.position,
          status:   inj.status,
          type:     inj.type,
          details:  inj.details,
          date:     inj.date,
        })),
      })),
    };
  },
};

// ─── Tool: get ESPN game odds ─────────────────────────────────────────────────

export const getEspnGameOdds: AgentTool = {
  definition: {
    name: "get_espn_game_odds",
    description: "Get odds from ESPN's pickcenter for a specific game. Includes spread, moneyline, and over/under from providers like ESPN BET, Caesars, DraftKings, FanDuel. Useful for supplementing The Odds API data.",
    input_schema: {
      type: "object" as const,
      properties: {
        sport:       { type: "string", enum: ["NFL", "NBA", "MLB", "NHL"] },
        espnEventId: { type: "string", description: "ESPN event ID (from get_espn_scoreboard or get_espn_game_result)" },
      },
      required: ["sport", "espnEventId"],
    },
  },
  execute: async ({ sport, espnEventId }: { sport: string; espnEventId: string }) => {
    const map = ESPN_SPORT_MAP[sport];
    if (!map) return { error: `Unknown sport: ${sport}` };
    return getGameOdds(map.sport, map.league, espnEventId);
  },
};
