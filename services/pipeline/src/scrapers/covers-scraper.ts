/**
 * Covers.com public betting % scraper.
 * Second source for betting consensus — cross-referencing Action Network
 * helps detect when one source is delayed or showing stale data.
 *
 * Covers exposes betting % data via their consensus API endpoint.
 * No auth required, standard browser headers needed.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "../../../api/src/db/schema.js";

const COVERS_BASE = "https://www.covers.com/api/consensus";

// Covers sport slugs
const COVERS_SPORTS: Record<string, string> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept":     "application/json, text/plain, */*",
  "Referer":    "https://www.covers.com/sports/nfl/matchups",
  "Origin":     "https://www.covers.com",
};

interface CoversGame {
  eventId:    string;
  homeTeam:   { name: string; fullName: string };
  awayTeam:   { name: string; fullName: string };
  startTime:  string;
  consensus?: {
    spread?: { home: { betsPercent: number; moneyPercent: number }; away: { betsPercent: number; moneyPercent: number } };
    moneyline?: { home: { betsPercent: number; moneyPercent: number }; away: { betsPercent: number; moneyPercent: number } };
    total?: { over: { betsPercent: number; moneyPercent: number }; under: { betsPercent: number; moneyPercent: number } };
  };
}

async function fetchCoversGames(sport: string): Promise<CoversGame[]> {
  const today = new Date().toISOString().slice(0, 10);
  const url = `${COVERS_BASE}/${sport}/games?date=${today}`;

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[Covers] ${sport} returned ${res.status}`);
      return [];
    }

    const data = await res.json() as { games?: CoversGame[] } | CoversGame[];
    return Array.isArray(data) ? data : (data.games ?? []);
  } catch (err) {
    console.warn(`[Covers] ${sport} fetch error:`, (err as Error).message);
    return [];
  }
}

export async function runCoversScraper(db: ReturnType<typeof drizzle>): Promise<{
  gamesProcessed: number;
  recordsWritten: number;
}> {
  let gamesProcessed = 0;
  let recordsWritten = 0;

  for (const [sport, slug] of Object.entries(COVERS_SPORTS)) {
    const games = await fetchCoversGames(slug);

    for (const game of games) {
      if (!game.consensus) continue;

      // Match to our DB game
      const dbGame = await (db as ReturnType<typeof drizzle<typeof schema>>).query.games.findFirst({
        where: and(
          eq(schema.games.sport, sport),
          eq(schema.games.homeTeam, game.homeTeam.fullName ?? game.homeTeam.name),
        ),
      });

      if (!dbGame) continue;

      const records: Array<typeof schema.publicBettingData.$inferInsert> = [];
      const capturedAt = new Date().toISOString();
      const c = game.consensus;

      // Spread %
      if (c.spread) {
        records.push({
          gameId: dbGame.id, market: "spreads",
          label:    game.homeTeam.fullName ?? game.homeTeam.name,
          betsPct:  c.spread.home.betsPercent?.toString(),
          moneyPct: c.spread.home.moneyPercent?.toString(),
          source: "covers", capturedAt,
        });
        records.push({
          gameId: dbGame.id, market: "spreads",
          label:    game.awayTeam.fullName ?? game.awayTeam.name,
          betsPct:  c.spread.away.betsPercent?.toString(),
          moneyPct: c.spread.away.moneyPercent?.toString(),
          source: "covers", capturedAt,
        });
      }

      // Moneyline %
      if (c.moneyline) {
        records.push({
          gameId: dbGame.id, market: "h2h",
          label:    game.homeTeam.fullName ?? game.homeTeam.name,
          betsPct:  c.moneyline.home.betsPercent?.toString(),
          moneyPct: c.moneyline.home.moneyPercent?.toString(),
          source: "covers", capturedAt,
        });
        records.push({
          gameId: dbGame.id, market: "h2h",
          label:    game.awayTeam.fullName ?? game.awayTeam.name,
          betsPct:  c.moneyline.away.betsPercent?.toString(),
          moneyPct: c.moneyline.away.moneyPercent?.toString(),
          source: "covers", capturedAt,
        });
      }

      // Totals %
      if (c.total) {
        records.push({
          gameId: dbGame.id, market: "totals", label: "Over",
          betsPct:  c.total.over.betsPercent?.toString(),
          moneyPct: c.total.over.moneyPercent?.toString(),
          source: "covers", capturedAt,
        });
        records.push({
          gameId: dbGame.id, market: "totals", label: "Under",
          betsPct:  c.total.under.betsPercent?.toString(),
          moneyPct: c.total.under.moneyPercent?.toString(),
          source: "covers", capturedAt,
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

    if (games.length) {
      console.log(`[Covers] ${sport}: ${games.length} games, ${recordsWritten} records`);
    }
  }

  return { gamesProcessed, recordsWritten };
}
