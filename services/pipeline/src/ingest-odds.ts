/**
 * Direct odds ingestion — bypasses the agent loop for deterministic data fetching.
 * Run with: pnpm --filter @sharp-edge/pipeline exec tsx src/ingest-odds.ts
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env.local"));
} catch { /* ignore — env may already be set */ }

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { desc, eq, and, gte, inArray } from "drizzle-orm";
import * as schema from "../../api/src/db/schema.js";

const ODDS_API_KEY  = process.env["ODDS_API_KEY"] ?? "";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const BOOKS         = "draftkings,fanduel,betmgm,caesars,pinnacle";
const API_URL       = process.env["API_URL"] ?? "http://localhost:3001";

async function postSharpAlert(payload: {
  gameId: string; homeTeam: string; awayTeam: string;
  market: string; label: string; priceBefore: number; priceAfter: number; books: string[];
}) {
  try {
    await fetch(`${API_URL}/internal/sharp-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, detectedAt: new Date().toISOString() }),
    });
  } catch { /* API may not be running in CI */ }
}

// Sports active in May (NBA/NHL playoffs + MLB regular season)
const SPORTS = [
  { key: "basketball_nba",  sport: "NBA", league: "NBA" },
  { key: "icehockey_nhl",   sport: "NHL", league: "NHL" },
  { key: "baseball_mlb",    sport: "MLB", league: "MLB" },
];

interface OddsApiGame {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

async function fetchOdds(sportKey: string): Promise<OddsApiGame[]> {
  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&bookmakers=${BOOKS}&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const remaining = res.headers.get("x-requests-remaining");
  if (remaining) console.log(`  API requests remaining: ${remaining}`);
  return res.json() as Promise<OddsApiGame[]>;
}

async function main() {
  if (!ODDS_API_KEY) {
    console.error("ODDS_API_KEY not set — add it to .env.local");
    process.exit(1);
  }

  if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL not set — is Docker running?");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 3 });
  const db   = drizzle(pool, { schema });

  let totalGames  = 0;
  let totalOdds   = 0;
  let sharpMoves  = 0;

  for (const { key, sport, league } of SPORTS) {
    console.log(`\nFetching ${sport} odds...`);

    let games: OddsApiGame[];
    try {
      games = await fetchOdds(key);
    } catch (err) {
      console.error(`  Skipping ${sport}: ${(err as Error).message}`);
      continue;
    }

    console.log(`  ${games.length} games returned`);

    for (const g of games) {
      // Upsert game record
      const [gameRow] = await db
        .insert(schema.games)
        .values({
          externalId: g.id,
          sport,
          league,
          homeTeam:   g.home_team,
          awayTeam:   g.away_team,
          gameTime:   g.commence_time,
          status:     "scheduled",
        })
        .onConflictDoUpdate({
          target: schema.games.externalId,
          set:    { updatedAt: new Date().toISOString() },
        })
        .returning({ id: schema.games.id });

      const gameId = gameRow!.id;

      // Collect all odds records from all bookmakers
      const oddsRecords: Array<{
        gameId: string; book: string; market: string;
        label: string; price: number; point: string | undefined; isOpening: boolean;
      }> = [];

      // Track price spread across books per market+label for sharp detection
      const bookPrices: Record<string, number[]> = {};

      for (const bm of g.bookmakers ?? []) {
        for (const mkt of bm.markets ?? []) {
          for (const outcome of mkt.outcomes ?? []) {
            const label = outcome.point != null
              ? `${outcome.name} ${outcome.point > 0 ? "+" : ""}${outcome.point}`
              : outcome.name;

            const spreadKey = `${mkt.key}:${label}`;
            if (!bookPrices[spreadKey]) bookPrices[spreadKey] = [];
            bookPrices[spreadKey].push(outcome.price);

            oddsRecords.push({
              gameId,
              book:      bm.key,
              market:    mkt.key,
              label,
              price:     outcome.price,
              point:     outcome.point?.toString(),
              isOpening: false,
            });
          }
        }
      }

      // Detect sharp moves: large spread between sharpest (Pinnacle) and square books
      for (const [mktLabel, prices] of Object.entries(bookPrices)) {
        if (prices.length < 2) continue;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (Math.abs(max - min) >= 20) {
          const [mkt, ...labelParts] = mktLabel.split(":");
          const label = labelParts.join(":");
          console.log(`  SHARP MOVE: ${g.home_team} vs ${g.away_team} ${mkt} ${label} spread=${max - min}`);
          sharpMoves++;
          await postSharpAlert({
            gameId,
            homeTeam: g.home_team,
            awayTeam: g.away_team,
            market: mkt ?? "unknown",
            label,
            priceBefore: min,
            priceAfter: max,
            books: g.bookmakers?.map((b: { key: string }) => b.key) ?? [],
          });
        }
      }

      if (oddsRecords.length) {
        await db.insert(schema.oddsHistory).values(oddsRecords);
        totalOdds += oddsRecords.length;
      }

      totalGames++;
    }
  }

  await pool.end();

  console.log(`\nIngest complete:`);
  console.log(`  Games processed : ${totalGames}`);
  console.log(`  Odds written    : ${totalOdds}`);
  console.log(`  Sharp moves     : ${sharpMoves}`);
  console.log(`\nRun score-confidence.ts next to generate EdgeFeed data.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
