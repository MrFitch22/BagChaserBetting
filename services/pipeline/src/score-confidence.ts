/**
 * Confidence scorer — reads latest odds from DB and writes confidence scores.
 * Run with: pnpm --filter @sharp-edge/pipeline exec tsx src/score-confidence.ts
 *
 * Algorithm (v1 — odds only):
 *  - Book consensus (matchup signal): how tightly all books agree on a price
 *  - Sharp money signal: spread between Pinnacle (sharp) and square books
 *  - Other signals (playerTrend, sentiment, etc.) default to 50 until their
 *    respective agents are wired in
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env.local"));
} catch { /* ignore */ }

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import * as schema from "../../api/src/db/schema.js";

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

async function main() {
  if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL not set — is Docker running?");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 3 });
  const db   = drizzle(pool, { schema });

  const now     = new Date();
  const cutoff  = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const oneHour = new Date(now.getTime() - 60 * 60 * 1000);

  // Fetch all upcoming games
  const upcomingGames = await db.query.games.findMany({
    where: and(
      gte(schema.games.gameTime, now.toISOString()),
      lte(schema.games.gameTime, cutoff.toISOString()),
    ),
  });

  if (!upcomingGames.length) {
    console.log("No upcoming games found — run ingest-odds.ts first.");
    await pool.end();
    return;
  }

  console.log(`Scoring ${upcomingGames.length} games...`);
  let scored = 0;

  for (const game of upcomingGames) {
    // Get the last hour of odds for this game
    const odds = await db
      .select()
      .from(schema.oddsHistory)
      .where(
        and(
          eq(schema.oddsHistory.gameId, game.id),
          gte(schema.oddsHistory.capturedAt, oneHour.toISOString()),
        )
      )
      .orderBy(desc(schema.oddsHistory.capturedAt));

    if (!odds.length) continue;

    // Group by market + label
    const groups = new Map<string, { prices: number[]; pinnaclePrice: number | null }>();

    for (const o of odds) {
      const key = `${o.market}:::${o.label ?? ""}`;
      if (!groups.has(key)) groups.set(key, { prices: [], pinnaclePrice: null });
      const g = groups.get(key)!;
      g.prices.push(o.price);
      if (o.book === "pinnacle") g.pinnaclePrice = o.price;
    }

    for (const [key, { prices, pinnaclePrice }] of groups) {
      const [market, label] = key.split(":::");
      if (!market || !label) continue;

      const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
      const spread   = stdDev(prices);

      // matchup / consensus: tight spread across books = high confidence (100 when spread=0)
      const matchup = clamp(100 - spread * 3);

      // sharpMoney: Pinnacle vs square average (−50 to +50)
      // Positive = Pinnacle is sharper (offering better value) → sharp money on this side
      let sharpMoney = 0;
      if (pinnaclePrice !== null) {
        const squarePrices = prices.filter((_, i) => {
          const o = odds.find((o) => o.price === prices[i]);
          return o?.book !== "pinnacle";
        });
        if (squarePrices.length) {
          const squareAvg = squarePrices.reduce((s, p) => s + p, 0) / squarePrices.length;
          // Pinnacle offers a better number = sharp money is here
          sharpMoney = clamp((pinnaclePrice - squareAvg) * 1.5, -50, 50);
        }
      }

      // Composite score (weighted)
      const score = clamp(
        matchup          * 0.35 +
        (sharpMoney + 50) * 0.35 + // normalise -50..50 → 0..100
        50               * 0.30,   // neutral for unscored signals
      );

      // Write confidence score (upsert isn't available for this table — just insert fresh)
      await db.insert(schema.confidenceScores).values({
        gameId:       game.id,
        market:       market!,
        label:        label!,
        score:        score.toFixed(2),
        playerTrend:  "50",
        sharpMoney:   sharpMoney.toFixed(2),
        sentiment:    "50",
        scheduleEdge: matchup.toFixed(2),
        pickTracker:  "50",
        modelVersion: "v1-odds",
        computedAt:   now.toISOString(),
      });

      scored++;
    }
  }

  await pool.end();
  console.log(`Done — wrote ${scored} confidence scores.`);
  console.log(`EdgeFeed at /api/scores/top-edges is now live.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
