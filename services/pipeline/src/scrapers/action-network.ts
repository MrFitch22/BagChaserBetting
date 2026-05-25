/**
 * Action Network scraper — public betting percentages.
 * Uses their unofficial JSON API (no browser required).
 * Populates publicBettingData table which feeds the intelligence engine.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and } from "drizzle-orm";
import * as schema from "../../../api/src/db/schema.js";

const BASE = "https://api.actionnetwork.com/web/v1";

// Action Network sport IDs
const SPORT_IDS: Record<string, { id: number; league: string }> = {
  NBA: { id: 3,  league: "nba" },
  NHL: { id: 6,  league: "nhl" },
  MLB: { id: 1,  league: "mlb" },
  NFL: { id: 2,  league: "nfl" },
};

interface ANGame {
  id: number;
  away_team: { full_name: string; abbr: string };
  home_team: { full_name: string; abbr: string };
  start_time: string;
  teams: Array<{
    id: number;
    full_name: string;
    spread_bets_pct?: number;
    spread_money_pct?: number;
    ml_bets_pct?: number;
    ml_money_pct?: number;
  }>;
  total?: {
    over_bets_pct?: number;
    over_money_pct?: number;
    under_bets_pct?: number;
    under_money_pct?: number;
  };
}

async function fetchGames(sportId: number, league: string): Promise<ANGame[]> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = `${BASE}/scoreboard/${league}?date=${today}&sport_id=${sportId}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Referer": "https://www.actionnetwork.com/",
    },
  });

  if (!res.ok) {
    console.warn(`[ActionNetwork] ${league} returned ${res.status}`);
    return [];
  }

  const data = await res.json() as { games?: ANGame[] };
  return data.games ?? [];
}

export async function runActionNetworkScraper(db: ReturnType<typeof drizzle>): Promise<{
  gamesProcessed: number;
  recordsWritten: number;
}> {
  let gamesProcessed = 0;
  let recordsWritten = 0;

  for (const [sport, { id, league }] of Object.entries(SPORT_IDS)) {
    let games: ANGame[];
    try {
      games = await fetchGames(id, league);
    } catch (err) {
      console.warn(`[ActionNetwork] Failed to fetch ${sport}:`, (err as Error).message);
      continue;
    }

    for (const game of games) {
      // Try to find matching game in our DB by team names
      const dbGame = await (db as ReturnType<typeof drizzle<typeof schema>>).query.games.findFirst({
        where: and(
          eq(schema.games.sport, sport),
          eq(schema.games.homeTeam, game.home_team.full_name),
        ),
      });

      if (!dbGame) continue;

      const records: Array<typeof schema.publicBettingData.$inferInsert> = [];
      const capturedAt = new Date().toISOString();

      // Spread betting %
      for (const team of game.teams ?? []) {
        if (team.spread_bets_pct != null) {
          records.push({
            gameId:     dbGame.id,
            market:     "spreads",
            label:      team.full_name,
            betsPct:    team.spread_bets_pct.toString(),
            moneyPct:   team.spread_money_pct?.toString(),
            source:     "action_network",
            capturedAt,
          });
        }
        if (team.ml_bets_pct != null) {
          records.push({
            gameId:     dbGame.id,
            market:     "h2h",
            label:      team.full_name,
            betsPct:    team.ml_bets_pct.toString(),
            moneyPct:   team.ml_money_pct?.toString(),
            source:     "action_network",
            capturedAt,
          });
        }
      }

      // Totals betting %
      if (game.total?.over_bets_pct != null) {
        records.push({
          gameId: dbGame.id, market: "totals", label: "Over",
          betsPct: game.total.over_bets_pct.toString(),
          moneyPct: game.total.over_money_pct?.toString(),
          source: "action_network", capturedAt,
        });
        records.push({
          gameId: dbGame.id, market: "totals", label: "Under",
          betsPct: game.total.under_bets_pct?.toString(),
          moneyPct: game.total.under_money_pct?.toString(),
          source: "action_network", capturedAt,
        });
      }

      if (records.length) {
        await (db as ReturnType<typeof drizzle<typeof schema>>)
          .insert(schema.publicBettingData)
          .values(records);
        recordsWritten += records.length;
      }

      gamesProcessed++;
    }

    console.log(`[ActionNetwork] ${sport}: ${games.length} games fetched`);
  }

  return { gamesProcessed, recordsWritten };
}
