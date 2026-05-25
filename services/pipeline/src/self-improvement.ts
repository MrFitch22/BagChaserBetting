/**
 * Recursive Self-Improvement Engine — runs nightly at 4 AM.
 *
 * Analyses the system's own prediction history (systemPredictions table)
 * and adjusts signal weights for each sport based on what's actually been working.
 *
 * Algorithm:
 *   1. Pull all graded predictions from the last 90 days
 *   2. For each sport, group by win/loss
 *   3. Signal attribution: which signals were "strong" (≥65) on wins vs losses?
 *   4. Winning signals get a small weight bump (+0.005)
 *      Losing signals get a smaller cut (−0.003) — asymmetric to reward winners more
 *   5. Normalize so weights sum to 1.0 per sport
 *   6. Apply floor (0.02) and ceiling (0.45) per signal
 *   7. Write new weights to model_weights table
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try { process.loadEnvFile(resolve(__dirname, "../../../.env.local")); } catch { /* ignore */ }

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import * as schema from "../../api/src/db/schema.js";

// ─── Hardcoded baseline weights (used to seed model_weights on first run) ─────

export const BASELINE_WEIGHTS: Record<string, Record<string, number>> = {
  NBA: { sharpMoney: 0.30, lineMovement: 0.15, matchup: 0.15, publicMoney: 0.12, playerTrend: 0.12, sentiment: 0.10, pickTracker: 0.06, scheduleEdge: 0.00, weatherFactor: 0.00 },
  NHL: { sharpMoney: 0.25, lineMovement: 0.18, matchup: 0.22, publicMoney: 0.08, playerTrend: 0.12, sentiment: 0.08, pickTracker: 0.05, scheduleEdge: 0.02, weatherFactor: 0.00 },
  NFL: { sharpMoney: 0.23, lineMovement: 0.11, matchup: 0.13, publicMoney: 0.14, playerTrend: 0.09, sentiment: 0.13, pickTracker: 0.05, scheduleEdge: 0.04, weatherFactor: 0.08 },
  MLB: { sharpMoney: 0.20, lineMovement: 0.16, matchup: 0.18, publicMoney: 0.09, playerTrend: 0.13, sentiment: 0.07, pickTracker: 0.04, scheduleEdge: 0.02, weatherFactor: 0.11 },
  DEFAULT: { sharpMoney: 0.24, lineMovement: 0.14, matchup: 0.17, publicMoney: 0.10, playerTrend: 0.11, sentiment: 0.11, pickTracker: 0.06, scheduleEdge: 0.02, weatherFactor: 0.05 },
};

const SIGNALS = ["sharpMoney", "lineMovement", "matchup", "publicMoney", "playerTrend", "sentiment", "pickTracker", "scheduleEdge", "weatherFactor"] as const;
type Signal = typeof SIGNALS[number];

const STRONG_THRESHOLD = 65; // signal value >= this = "strong agreement"
const WIN_BUMP         = 0.005;
const LOSS_CUT         = 0.003;
const WEIGHT_FLOOR     = 0.02;
const WEIGHT_CEILING   = 0.45;
const MIN_SAMPLE       = 10;   // minimum predictions per sport before adjusting (avoid noise)

// ─── Load current weights from DB (or baseline if not seeded) ─────────────────

export async function loadWeightsFromDb(
  db: ReturnType<typeof drizzle<typeof schema>>,
  sport: string
): Promise<Record<Signal, number>> {
  const rows = await db.query.modelWeights.findMany({
    where: eq(schema.modelWeights.sport, sport),
  });

  if (!rows.length) {
    return { ...(BASELINE_WEIGHTS[sport] ?? BASELINE_WEIGHTS["DEFAULT"]!) } as Record<Signal, number>;
  }

  const weights: Partial<Record<Signal, number>> = {};
  for (const row of rows) {
    if (SIGNALS.includes(row.signal as Signal)) {
      weights[row.signal as Signal] = parseFloat(row.weight);
    }
  }

  // Fill any missing signals from baseline
  const base = BASELINE_WEIGHTS[sport] ?? BASELINE_WEIGHTS["DEFAULT"]!;
  for (const sig of SIGNALS) {
    if (weights[sig] === undefined) weights[sig] = base[sig] ?? 0;
  }

  return weights as Record<Signal, number>;
}

// ─── Seed weights table from baselines (first run) ───────────────────────────

export async function seedWeightsIfEmpty(db: ReturnType<typeof drizzle<typeof schema>>): Promise<void> {
  const existing = await db.query.modelWeights.findFirst();
  if (existing) return;

  const now = new Date().toISOString();
  const rows: typeof schema.modelWeights.$inferInsert[] = [];

  for (const [sport, weights] of Object.entries(BASELINE_WEIGHTS)) {
    for (const [signal, weight] of Object.entries(weights)) {
      rows.push({ sport, signal, weight: weight.toString(), sampleSize: 0, updatedAt: now });
    }
  }

  await db.insert(schema.modelWeights).values(rows);
  console.log(`[SelfImprovement] Seeded ${rows.length} baseline weights`);
}

// ─── Main: analyse predictions and update weights ─────────────────────────────

export async function runSelfImprovement(): Promise<{
  sportsUpdated: string[];
  totalPredictionsAnalysed: number;
}> {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");

  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 3 });
  const db   = drizzle(pool, { schema });

  await seedWeightsIfEmpty(db);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Pull all graded predictions from last 90 days
  const predictions = await db.query.systemPredictions.findMany({
    where: and(
      isNotNull(schema.systemPredictions.result),
      gte(schema.systemPredictions.gradedAt, ninetyDaysAgo),
    ),
    limit: 2000,
  });

  console.log(`[SelfImprovement] Analysing ${predictions.length} graded predictions`);

  // Group by sport
  const bySport = new Map<string, typeof predictions>();
  for (const p of predictions) {
    const sport = p.sport.toUpperCase();
    if (!bySport.has(sport)) bySport.set(sport, []);
    bySport.get(sport)!.push(p);
  }

  const sportsUpdated: string[] = [];
  const now = new Date().toISOString();

  for (const [sport, preds] of bySport) {
    if (preds.length < MIN_SAMPLE) {
      console.log(`[SelfImprovement] ${sport}: only ${preds.length} samples — skipping (need ${MIN_SAMPLE})`);
      continue;
    }

    const wins   = preds.filter((p) => p.result === "win");
    const losses = preds.filter((p) => p.result === "loss");
    const winRate = wins.length / (wins.length + losses.length);

    console.log(`[SelfImprovement] ${sport}: ${preds.length} preds, ${(winRate * 100).toFixed(1)}% win rate`);

    // Load current weights
    const weights = await loadWeightsFromDb(db as ReturnType<typeof drizzle<typeof schema>>, sport);

    // Signal attribution: count how often each signal was "strong" on wins vs losses
    const signalWinStrong:  Record<string, number> = {};
    const signalLossStrong: Record<string, number> = {};

    for (const sig of SIGNALS) {
      signalWinStrong[sig]  = 0;
      signalLossStrong[sig] = 0;
    }

    for (const pred of wins) {
      const vals = pred.signalValues as Record<string, number>;
      for (const sig of SIGNALS) {
        if ((vals[sig] ?? 0) >= STRONG_THRESHOLD) signalWinStrong[sig] = (signalWinStrong[sig] ?? 0) + 1;
      }
    }

    for (const pred of losses) {
      const vals = pred.signalValues as Record<string, number>;
      for (const sig of SIGNALS) {
        if ((vals[sig] ?? 0) >= STRONG_THRESHOLD) signalLossStrong[sig] = (signalLossStrong[sig] ?? 0) + 1;
      }
    }

    // Adjust weights
    const newWeights = { ...weights };
    for (const sig of SIGNALS) {
      const winRate  = wins.length  > 0 ? (signalWinStrong[sig]  ?? 0) / wins.length  : 0;
      const lossRate = losses.length > 0 ? (signalLossStrong[sig] ?? 0) / losses.length : 0;

      // Signal is "useful" if it fires more on wins than losses
      if (winRate > lossRate + 0.05) {
        newWeights[sig] = Math.min(WEIGHT_CEILING, newWeights[sig] + WIN_BUMP);
      } else if (lossRate > winRate + 0.05) {
        newWeights[sig] = Math.max(WEIGHT_FLOOR, newWeights[sig] - LOSS_CUT);
      }
    }

    // Normalize to sum = 1.0
    const total = SIGNALS.reduce((s, sig) => s + newWeights[sig], 0);
    for (const sig of SIGNALS) {
      newWeights[sig] = parseFloat((newWeights[sig] / total).toFixed(4));
    }

    // Upsert into model_weights
    for (const sig of SIGNALS) {
      await db.insert(schema.modelWeights)
        .values({ sport, signal: sig, weight: newWeights[sig].toString(), sampleSize: preds.length, updatedAt: now })
        .onConflictDoUpdate({
          target: [schema.modelWeights.sport, schema.modelWeights.signal],
          set: { weight: newWeights[sig].toString(), sampleSize: preds.length, updatedAt: now },
        });
    }

    console.log(`[SelfImprovement] ${sport} weights updated (${preds.length} samples):`);
    for (const sig of SIGNALS) {
      const delta = newWeights[sig] - weights[sig];
      if (Math.abs(delta) > 0.001) {
        console.log(`  ${sig}: ${weights[sig].toFixed(4)} → ${newWeights[sig].toFixed(4)} (${delta > 0 ? "+" : ""}${delta.toFixed(4)})`);
      }
    }

    sportsUpdated.push(sport);
  }

  await pool.end();
  return { sportsUpdated, totalPredictionsAnalysed: predictions.length };
}

// CLI entrypoint
const isMain = process.argv[1]?.endsWith("self-improvement.ts") || process.argv[1]?.endsWith("self-improvement.js");
if (isMain) {
  runSelfImprovement().then((r) => {
    console.log(`Done. Sports updated: ${r.sportsUpdated.join(", ") || "none (insufficient data yet)"}`);
    process.exit(0);
  }).catch((e) => { console.error(e); process.exit(1); });
}
