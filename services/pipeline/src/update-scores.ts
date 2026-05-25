/**
 * Update-scores job — runs hourly via cron.
 *
 * 1. Finds games that finished in the last 3 hours (status != 'final' but gameTime has passed)
 * 2. Fetches the final score from ESPN
 * 3. Updates the games table
 * 4. Grades any system_predictions for those games (win/loss/push)
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try { process.loadEnvFile(resolve(__dirname, "../../../.env.local")); } catch { /* ignore */ }

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, lt, gte, isNull } from "drizzle-orm";
import * as schema from "../../api/src/db/schema.js";
import { ESPN_SPORT_MAP, findGame } from "./clients/espn-client.js";

const SPORT_MAP: Record<string, string> = {
  NFL: "NFL", NBA: "NBA", MLB: "MLB", NHL: "NHL",
};

function determineResult(
  market: string, label: string,
  homeTeam: string, awayTeam: string,
  homeScore: number, awayScore: number,
): "win" | "loss" | "push" | null {
  const scoreDiff = homeScore - awayScore; // positive = home won

  if (market === "h2h") {
    const homeWon = homeScore > awayScore;
    const isHome  = label.toLowerCase().includes(homeTeam.toLowerCase().split(" ").pop()!);
    if (homeScore === awayScore) return "push";
    return (isHome ? homeWon : !homeWon) ? "win" : "loss";
  }

  if (market === "spreads") {
    // label like "Kansas City Chiefs -6.5"
    const match = label.match(/([-+]?\d+\.?\d*)$/);
    if (!match) return null;
    const spread = parseFloat(match[1]!);
    const isHome = label.toLowerCase().includes(homeTeam.toLowerCase().split(" ").pop()!);
    const coverDiff = isHome ? scoreDiff + spread : -scoreDiff + spread;
    if (Math.abs(coverDiff) < 0.01) return "push";
    return coverDiff > 0 ? "win" : "loss";
  }

  if (market === "totals") {
    const match = label.match(/\d+\.?\d*/);
    if (!match) return null;
    const total = parseFloat(match[0]!);
    const actualTotal = homeScore + awayScore;
    if (Math.abs(actualTotal - total) < 0.01) return "push";
    const isOver = label.toLowerCase().includes("over");
    return (isOver ? actualTotal > total : actualTotal < total) ? "win" : "loss";
  }

  return null;
}

export async function runUpdateScores(): Promise<{ gamesUpdated: number; predictionsGraded: number }> {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 3 });
  const db   = drizzle(pool, { schema });

  const now        = new Date();
  const threeHours = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const oneDay     = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Games that started in the last 24h but aren't marked final yet
  const pendingGames = await db.query.games.findMany({
    where: and(
      lt(schema.games.gameTime, now.toISOString()),
      gte(schema.games.gameTime, oneDay.toISOString()),
      eq(schema.games.status, "scheduled"),
    ),
    limit: 30,
  });

  let gamesUpdated = 0;
  let predictionsGraded = 0;

  for (const game of pendingGames) {
    const sportCode = SPORT_MAP[game.sport.toUpperCase()];
    if (!sportCode) continue;

    const map = ESPN_SPORT_MAP[sportCode];
    if (!map) continue;

    try {
      const espnGame = await findGame(map.sport, map.league, game.homeTeam, game.awayTeam);
      if (!espnGame?.status.type.completed) continue;
      if (espnGame.homeTeam.score === null || espnGame.awayTeam.score === null) continue;

      const homeScore = espnGame.homeTeam.score;
      const awayScore = espnGame.awayTeam.score;

      // Update game record
      await db.update(schema.games)
        .set({ status: "final", homeScore, awayScore, updatedAt: now.toISOString() })
        .where(eq(schema.games.id, game.id));

      gamesUpdated++;
      console.log(`[UpdateScores] ${game.awayTeam} @ ${game.homeTeam}: ${awayScore}-${homeScore} final`);

      // Grade any ungraded system_predictions for this game
      const preds = await db.query.systemPredictions.findMany({
        where: and(
          eq(schema.systemPredictions.gameId, game.id),
          isNull(schema.systemPredictions.result),
        ),
      });

      for (const pred of preds) {
        const result = determineResult(
          pred.market, pred.label,
          game.homeTeam, game.awayTeam,
          homeScore, awayScore,
        );
        if (!result) continue;

        await db.update(schema.systemPredictions)
          .set({ result, homeScore, awayScore, gradedAt: now.toISOString() })
          .where(eq(schema.systemPredictions.id, pred.id));

        predictionsGraded++;
      }
    } catch (err) {
      console.warn(`[UpdateScores] ${game.homeTeam} fetch failed:`, (err as Error).message);
    }
  }

  await pool.end();
  console.log(`[UpdateScores] ${gamesUpdated} games updated, ${predictionsGraded} predictions graded`);
  return { gamesUpdated, predictionsGraded };
}

// CLI entrypoint
const isMain = process.argv[1]?.endsWith("update-scores.ts") || process.argv[1]?.endsWith("update-scores.js");
if (isMain) {
  runUpdateScores().then(console.log).catch((e) => { console.error(e); process.exit(1); });
}
