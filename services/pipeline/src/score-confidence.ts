/**
 * Intelligence Engine v3 — dynamic multi-signal confidence scorer.
 *
 * 8 signals, sport-specific weights, dynamic normalization.
 * Signals without real data have their weight redistributed to signals that do,
 * so a score backed by 3 signals is not diluted by 5 neutral defaults.
 *
 * Signals:
 *   sharpMoney    Pinnacle vs square book price gap
 *   lineMovement  Opening line vs current line velocity
 *   matchup       Cross-book price consensus (market certainty)
 *   publicMoney   Sharp vs public money divergence (contrarian signal)
 *   sentiment     News/social team sentiment
 *   playerTrend   Injury concern penalty
 *   pickTracker   Verified capper trust-weighted lean
 *   scheduleEdge  Rest day advantage between the two teams
 *
 * Run: pnpm --filter @sharp-edge/pipeline exec tsx src/score-confidence.ts
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env.local"));
} catch { /* ignore */ }

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, or, eq, gte, lte, lt, desc, inArray, isNull } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import * as schema from "../../api/src/db/schema.js";
import { getWeatherForVenue } from "./tools/weather-tools.js";
import { loadWeightsFromDb } from "./self-improvement.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalWeights {
  sharpMoney:    number;
  lineMovement:  number;
  matchup:       number;
  publicMoney:   number;
  sentiment:     number;
  playerTrend:   number;
  pickTracker:   number;
  scheduleEdge:  number;
  weatherFactor: number; // 0 for indoor sports (NBA/NHL), non-zero for NFL/MLB totals
}

interface Signal {
  value:   number;  // 0..100
  hasData: boolean; // false = neutral default, weight gets redistributed
}

// ─── Sport-specific base weights ─────────────────────────────────────────────
// Each sport responds differently to each signal type.
// NBA: high volume, efficient market — sharp money and line movement are king.
// NFL: most public action — public money divergence and sentiment matter more.
// MLB: very high game count — book consensus and player health drive outcomes.
// NHL: low public volume — tight book consensus reveals where sharp money is.

const SPORT_WEIGHTS: Record<string, SignalWeights> = {
  // Indoor sports — weather weight is 0, gets redistributed to other signals
  NBA: { sharpMoney: 0.30, lineMovement: 0.15, matchup: 0.15, publicMoney: 0.12, playerTrend: 0.12, sentiment: 0.10, pickTracker: 0.06, scheduleEdge: 0.00, weatherFactor: 0.00 },
  NHL: { sharpMoney: 0.25, lineMovement: 0.18, matchup: 0.22, publicMoney: 0.08, playerTrend: 0.12, sentiment: 0.08, pickTracker: 0.05, scheduleEdge: 0.02, weatherFactor: 0.00 },
  // Outdoor sports — weather matters, especially for totals
  NFL: { sharpMoney: 0.23, lineMovement: 0.11, matchup: 0.13, publicMoney: 0.14, playerTrend: 0.09, sentiment: 0.13, pickTracker: 0.05, scheduleEdge: 0.04, weatherFactor: 0.08 },
  MLB: { sharpMoney: 0.20, lineMovement: 0.16, matchup: 0.18, publicMoney: 0.09, playerTrend: 0.13, sentiment: 0.07, pickTracker: 0.04, scheduleEdge: 0.02, weatherFactor: 0.11 },
  DEFAULT: { sharpMoney: 0.24, lineMovement: 0.14, matchup: 0.17, publicMoney: 0.10, playerTrend: 0.11, sentiment: 0.11, pickTracker: 0.06, scheduleEdge: 0.02, weatherFactor: 0.05 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

// Convert American moneyline odds to implied probability (0..1)
function americanToProb(odds: number): number {
  if (odds <= 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

// Dynamic weight normalization:
// Signals without real data (hasData=false) contribute nothing.
// Their weight is redistributed proportionally among signals that DO have data.
function computeWeightedScore(
  signals: Record<keyof SignalWeights, Signal>,
  baseWeights: SignalWeights,
): { score: number; dataQuality: number } {
  const entries = Object.entries(signals) as [keyof SignalWeights, Signal][];
  const active   = entries.filter(([, s]) => s.hasData);
  const inactive = entries.filter(([, s]) => !s.hasData);

  const dataQuality = active.length / entries.length;

  if (active.length === 0) return { score: 50, dataQuality: 0 };

  // Total base weight of active signals
  const activeBaseTotal = active.reduce((sum, [k]) => sum + baseWeights[k], 0);
  // Total base weight of inactive signals (to be redistributed)
  const inactiveTotal   = inactive.reduce((sum, [k]) => sum + baseWeights[k], 0);

  const score = clamp(active.reduce((total, [k, sig]) => {
    // Each active signal gets its own base weight + its proportional share of inactive weight
    const effectiveWeight = activeBaseTotal > 0
      ? baseWeights[k] + (baseWeights[k] / activeBaseTotal) * inactiveTotal
      : 1 / active.length;
    return total + sig.value * effectiveWeight;
  }, 0));

  return { score, dataQuality };
}

// ─── Claude narrative ─────────────────────────────────────────────────────────

const anthropic = process.env["ANTHROPIC_API_KEY"]
  ? new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] })
  : null;

async function generateNarrative(
  game:    { homeTeam: string; awayTeam: string; sport: string },
  market:  string,
  label:   string,
  signals: Record<keyof SignalWeights, Signal>,
  score:   number,
): Promise<string | null> {
  if (!anthropic || score < 68) return null;

  const fmt = (key: keyof SignalWeights, label: string) => {
    const s = signals[key];
    if (!s.hasData) return null;
    const dir = s.value >= 65 ? "strong ✓" : s.value <= 40 ? "weak ✗" : "neutral";
    return `${label}: ${dir} (${s.value.toFixed(0)}/100)`;
  };

  const lines = [
    fmt("sharpMoney",    "Sharp money"),
    fmt("lineMovement",  "Line movement"),
    fmt("publicMoney",   "Public vs sharp divergence"),
    fmt("sentiment",     "Team sentiment"),
    fmt("playerTrend",   "Player health"),
    fmt("pickTracker",   "Verified cappers"),
    fmt("scheduleEdge",  "Rest edge"),
    fmt("weatherFactor", "Weather"),
  ].filter(Boolean).join(", ");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{
        role: "user",
        content: `Write one sentence (max 22 words) explaining this bet edge for a beginner. Be specific and clear, no jargon.

${game.homeTeam} vs ${game.awayTeam} (${game.sport}) — ${market} ${label} — Confidence: ${score}/100
Signals: ${lines}

One plain-English sentence, no quotes:`,
      }],
    });
    const text = response.content.find((b) => b.type === "text");
    return text?.type === "text" ? text.text.trim() : null;
  } catch {
    return null;
  }
}

// ─── Exported runner (callable from orchestrator graph) ───────────────────────

export interface ScorerResult {
  scored:              number;
  narrativesGenerated: number;
  gamesProcessed:      number;
}

export async function runConfidenceScorer(): Promise<ScorerResult> {
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL not set");
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 3 });
  const db   = drizzle(pool, { schema });

  const now     = new Date();
  const cutoff  = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const oneHour = new Date(now.getTime() - 60 * 60 * 1000);

  const upcomingGames = await db.query.games.findMany({
    where: and(
      gte(schema.games.gameTime, now.toISOString()),
      lte(schema.games.gameTime, cutoff.toISOString()),
    ),
  });

  if (!upcomingGames.length) {
    console.log("[Scorer] No upcoming games — run odds agent first.");
    await pool.end();
    return { scored: 0, narrativesGenerated: 0, gamesProcessed: 0 };
  }

  console.log(`[Scorer] Scoring ${upcomingGames.length} games with v3 intelligence engine...`);
  let scored = 0;
  let narrativesGenerated = 0;

  // Cache DB weights per sport to avoid repeated round-trips
  const weightsCache = new Map<string, SignalWeights>();

  for (const game of upcomingGames) {
    const sportKey = game.sport.toUpperCase();
    let sportWeights = weightsCache.get(sportKey);
    if (!sportWeights) {
      sportWeights = await loadWeightsFromDb(db, sportKey) as SignalWeights;
      weightsCache.set(sportKey, sportWeights);
    }

    // ── 1. Fetch current odds (last hour) ──────────────────────────────────
    const currentOdds = await db
      .select()
      .from(schema.oddsHistory)
      .where(and(
        eq(schema.oddsHistory.gameId, game.id),
        gte(schema.oddsHistory.capturedAt, oneHour.toISOString()),
        eq(schema.oddsHistory.isOpening, false),
      ))
      .orderBy(desc(schema.oddsHistory.capturedAt));

    if (!currentOdds.length) continue;

    // ── 2. Fetch opening odds ──────────────────────────────────────────────
    const openingOdds = await db
      .select()
      .from(schema.oddsHistory)
      .where(and(
        eq(schema.oddsHistory.gameId, game.id),
        eq(schema.oddsHistory.isOpening, true),
      ));

    // Opening price lookup: book:market:label → price
    const openingMap = new Map<string, number>();
    for (const o of openingOdds) {
      openingMap.set(`${o.book}:${o.market}:${o.label ?? ""}`, o.price);
    }

    // ── 3. Fetch sentiment ─────────────────────────────────────────────────
    const sentimentRows = await db.query.sentimentScores.findMany({
      where: and(
        eq(schema.sentimentScores.entityType, "team"),
        eq(schema.sentimentScores.entityId, game.id),
      ),
      orderBy: desc(schema.sentimentScores.computedAt),
      limit: 4,
    });

    const avgSentiment = sentimentRows.length
      ? sentimentRows.reduce((s, r) => s + parseFloat(r.score ?? "0"), 0) / sentimentRows.length
      : null;

    const maxInjuryConcern = sentimentRows.length
      ? Math.max(...sentimentRows.map((r) => parseFloat(r.injuryConcern ?? "0")))
      : null;

    // ── 4. Fetch public betting % ──────────────────────────────────────────
    const publicBettingRows = await db.query.publicBettingData.findMany({
      where: and(
        eq(schema.publicBettingData.gameId, game.id),
        gte(schema.publicBettingData.capturedAt, oneHour.toISOString()),
      ),
      orderBy: desc(schema.publicBettingData.capturedAt),
    });
    const publicMap = new Map<string, typeof publicBettingRows[0]>();
    for (const row of publicBettingRows) {
      const key = `${row.market}:${row.label}`;
      if (!publicMap.has(key)) publicMap.set(key, row);
    }

    // ── 5. Fetch capper picks ──────────────────────────────────────────────
    const recentPicks = await db
      .select({
        betLabel:   schema.trackedPicks.betLabel,
        trustScore: schema.socialAccounts.trustScore,
      })
      .from(schema.trackedPicks)
      .innerJoin(schema.socialAccounts, eq(schema.trackedPicks.accountId, schema.socialAccounts.id))
      .where(and(
        eq(schema.trackedPicks.gameId, game.id),
        inArray(schema.trackedPicks.result, ["pending", "win", "loss"]),
      ));

    // ── 6. Fetch weather for outdoor games ────────────────────────────────
    const sport = game.sport.toUpperCase();
    const isOutdoorSport = sport === "NFL" || sport === "MLB";
    const weatherSignal = isOutdoorSport && game.venue
      ? await getWeatherForVenue(game.venue)
      : null;

    // ── 7. Compute schedule rest edge ─────────────────────────────────────
    // Find last game for each team to get rest days
    const [homePrev, awayPrev] = await Promise.all([
      db.query.games.findFirst({
        where: and(
          eq(schema.games.sport, game.sport),
          or(
            eq(schema.games.homeTeam, game.homeTeam),
            eq(schema.games.awayTeam, game.homeTeam),
          ),
          lt(schema.games.gameTime, game.gameTime),
        ),
        orderBy: desc(schema.games.gameTime),
      }),
      db.query.games.findFirst({
        where: and(
          eq(schema.games.sport, game.sport),
          or(
            eq(schema.games.homeTeam, game.awayTeam),
            eq(schema.games.awayTeam, game.awayTeam),
          ),
          lt(schema.games.gameTime, game.gameTime),
        ),
        orderBy: desc(schema.games.gameTime),
      }),
    ]);

    const msPerDay = 86_400_000;
    const homeRestDays = homePrev
      ? (new Date(game.gameTime).getTime() - new Date(homePrev.gameTime).getTime()) / msPerDay
      : null;
    const awayRestDays = awayPrev
      ? (new Date(game.gameTime).getTime() - new Date(awayPrev.gameTime).getTime()) / msPerDay
      : null;

    // ── 8. Group current odds by market+label, score each ─────────────────
    const groups = new Map<string, {
      prices: number[];
      books:  string[];
      pinnaclePrice: number | null;
    }>();

    for (const o of currentOdds) {
      const key = `${o.market}:::${o.label ?? ""}`;
      if (!groups.has(key)) groups.set(key, { prices: [], books: [], pinnaclePrice: null });
      const g = groups.get(key)!;
      g.prices.push(o.price);
      g.books.push(o.book);
      if (o.book === "pinnacle") g.pinnaclePrice = o.price;
    }

    for (const [key, { prices, books, pinnaclePrice }] of groups) {
      const [market, label] = key.split(":::");
      if (!market || !label) continue;

      const isHomeSide = label.toLowerCase().includes(game.homeTeam.toLowerCase().split(" ")[0] ?? "");
      const isAwaySide = label.toLowerCase().includes(game.awayTeam.toLowerCase().split(" ")[0] ?? "");
      const isTotalSide = label === "Over" || label === "Under";

      // ── Signal 1: sharpMoney ─────────────────────────────────────────────
      let sharpMoneyValue = 50;
      let sharpMoneyHasData = false;
      if (pinnaclePrice !== null && prices.length > 1) {
        const squarePrices = prices.filter((_, i) => books[i] !== "pinnacle");
        if (squarePrices.length > 0) {
          const squareAvg = squarePrices.reduce((s, p) => s + p, 0) / squarePrices.length;
          // Positive: Pinnacle better (sharps like this side). Normalize -50..+50 → 0..100
          const raw = clamp((pinnaclePrice - squareAvg) * 1.5, -50, 50);
          sharpMoneyValue = clamp(raw + 50);
          sharpMoneyHasData = true;
        }
      }

      // ── Signal 2: lineMovement ───────────────────────────────────────────
      // Compare opening implied probability to current for each book.
      // Movement toward this side (higher implied prob) = positive signal.
      let lineMovementValue = 50;
      let lineMovementHasData = false;
      const probDeltas: number[] = [];
      for (let i = 0; i < prices.length; i++) {
        const book = books[i]!;
        const openKey = `${book}:${market}:${label}`;
        const openingPrice = openingMap.get(openKey);
        if (openingPrice !== undefined) {
          const probDelta = americanToProb(prices[i]!) - americanToProb(openingPrice);
          probDeltas.push(probDelta);
        }
      }
      if (probDeltas.length >= 2) {
        const avgDelta = probDeltas.reduce((s, d) => s + d, 0) / probDeltas.length;
        // Scale: ±0.05 prob delta maps to ±25 signal points from neutral 50
        lineMovementValue = clamp(50 + avgDelta * 500);
        lineMovementHasData = true;
      }

      // ── Signal 3: matchup (book consensus) ──────────────────────────────
      const spread = stdDev(prices);
      // 3+ books required for meaningful consensus
      const matchupValue = clamp(100 - spread * 3);
      const matchupHasData = prices.length >= 3;

      // ── Signal 4: publicMoney ────────────────────────────────────────────
      let publicMoneyValue = 50;
      let publicMoneyHasData = false;
      const publicKey = `${market}:${label}`;
      const publicRow = publicMap.get(publicKey)
        ?? [...publicMap.entries()]
            .find(([k]) => k.startsWith(`${market}:`) &&
              k.toLowerCase().includes((label.toLowerCase().split(" ")[0] ?? "")))?.[1];

      const publicPct = publicRow?.moneyPct != null
        ? parseFloat(publicRow.moneyPct.toString())
        : publicRow?.betsPct != null
          ? parseFloat(publicRow.betsPct.toString())
          : null;

      if (publicPct !== null) {
        // Contrarian: public light on this side + sharps lean = high signal
        const contrarian = clamp(100 - publicPct);
        const sharpDir = sharpMoneyValue; // already 0..100
        publicMoneyValue = clamp(contrarian * 0.6 + sharpDir * 0.4);
        publicMoneyHasData = true;
      }

      // ── Signal 5: sentiment ──────────────────────────────────────────────
      const sentimentValue = avgSentiment !== null
        ? clamp(50 + avgSentiment * 50)
        : 50;
      const sentimentHasData = avgSentiment !== null;

      // ── Signal 6: playerTrend ────────────────────────────────────────────
      const playerTrendValue = maxInjuryConcern !== null
        ? clamp(100 - maxInjuryConcern * 100)
        : 50;
      const playerTrendHasData = maxInjuryConcern !== null && maxInjuryConcern > 0;

      // ── Signal 7: pickTracker ────────────────────────────────────────────
      let pickTrackerValue = 50;
      let pickTrackerHasData = false;
      if (recentPicks.length > 0) {
        const totalTrust = recentPicks.reduce((s, p) => s + parseFloat(p.trustScore), 0);
        const onThis = recentPicks
          .filter((p) => p.betLabel?.toLowerCase().includes(label.toLowerCase().split(" ")[0] ?? ""))
          .reduce((s, p) => s + parseFloat(p.trustScore), 0);
        if (totalTrust > 0) {
          pickTrackerValue = clamp((onThis / totalTrust) * 100);
          pickTrackerHasData = true;
        }
      }

      // ── Signal 8: scheduleEdge ───────────────────────────────────────────
      // Positive for a side when that team has more rest than their opponent.
      let scheduleEdgeValue = 50;
      let scheduleEdgeHasData = false;
      if (homeRestDays !== null && awayRestDays !== null && !isTotalSide) {
        const restDiff = homeRestDays - awayRestDays; // positive = home has more rest
        const edgeForHome = clamp(50 + restDiff * 8); // 1 day diff = 8 points
        if (isHomeSide) {
          scheduleEdgeValue = edgeForHome;
          scheduleEdgeHasData = true;
        } else if (isAwaySide) {
          scheduleEdgeValue = clamp(100 - edgeForHome);
          scheduleEdgeHasData = true;
        }
      }

      // ── Signal 9: weatherFactor ──────────────────────────────────────────
      // Only applies to outdoor sports (NFL/MLB) and only to totals markets.
      // Wind/precipitation pushes totals Under; no weather = neutral (50).
      let weatherFactorValue = 50;
      let weatherFactorHasData = false;
      if (weatherSignal?.hasSignal && isTotalSide) {
        // weatherSignal.totalSignal: <50 = Under lean, >50 = Over lean
        if (label === "Under") {
          // If weather leans Under (signal < 50), that's a positive signal for "Under"
          weatherFactorValue = clamp(100 - weatherSignal.totalSignal);
        } else if (label === "Over") {
          weatherFactorValue = weatherSignal.totalSignal;
        }
        weatherFactorHasData = true;
      }

      // ── Composite: dynamic weight normalization ──────────────────────────
      const signals: Record<keyof SignalWeights, Signal> = {
        sharpMoney:    { value: sharpMoneyValue,    hasData: sharpMoneyHasData },
        lineMovement:  { value: lineMovementValue,  hasData: lineMovementHasData },
        matchup:       { value: matchupValue,       hasData: matchupHasData },
        publicMoney:   { value: publicMoneyValue,   hasData: publicMoneyHasData },
        sentiment:     { value: sentimentValue,     hasData: sentimentHasData },
        playerTrend:   { value: playerTrendValue,   hasData: playerTrendHasData },
        pickTracker:   { value: pickTrackerValue,   hasData: pickTrackerHasData },
        scheduleEdge:  { value: scheduleEdgeValue,  hasData: scheduleEdgeHasData },
        weatherFactor: { value: weatherFactorValue, hasData: weatherFactorHasData },
      };

      const { score, dataQuality } = computeWeightedScore(signals, sportWeights);

      // ── Narrative ────────────────────────────────────────────────────────
      const narrative = await generateNarrative(game, market, label, signals, Math.round(score));
      if (narrative) narrativesGenerated++;

      // Pull raw values for storage
      const sv = (k: keyof SignalWeights) => signals[k].value.toFixed(2);

      await db.insert(schema.confidenceScores).values({
        gameId:       game.id,
        market:       market!,
        label:        label!,
        score:        score.toFixed(2),
        sharpMoney:   sv("sharpMoney"),
        lineMovement: sv("lineMovement"),
        matchup:      sv("matchup"),
        publicMoney:  sv("publicMoney"),
        sentiment:    sv("sentiment"),
        playerTrend:  sv("playerTrend"),
        pickTracker:  sv("pickTracker"),
        scheduleEdge: sv("scheduleEdge"),
        dataQuality:  dataQuality.toFixed(3),
        narrative,
        modelVersion: "v3-dynamic",
        computedAt:   now.toISOString(),
      });

      scored++;

      // Save top picks to systemPredictions for self-improvement attribution
      if (score >= 68) {
        const existingPred = await db.query.systemPredictions.findFirst({
          where: and(
            eq(schema.systemPredictions.gameId, game.id),
            eq(schema.systemPredictions.market, market!),
            eq(schema.systemPredictions.label, label!),
            isNull(schema.systemPredictions.result),
          ),
        });

        if (!existingPred) {
          await db.insert(schema.systemPredictions).values({
            gameId:          game.id,
            market:          market!,
            label:           label!,
            confidenceScore: score.toFixed(2),
            signalValues: {
              sharpMoney:    Math.round(sharpMoneyValue),
              lineMovement:  Math.round(lineMovementValue),
              matchup:       Math.round(matchupValue),
              publicMoney:   Math.round(publicMoneyValue),
              sentiment:     Math.round(sentimentValue),
              playerTrend:   Math.round(playerTrendValue),
              pickTracker:   Math.round(pickTrackerValue),
              scheduleEdge:  Math.round(scheduleEdgeValue),
              weatherFactor: Math.round(weatherFactorValue),
            },
            sport:       game.sport,
            predictedAt: now.toISOString(),
          });
        }
      }
    }
  }

  await pool.end();
  console.log(`[Scorer] Done — ${scored} scores written, ${narrativesGenerated} narratives generated.`);
  return { scored, narrativesGenerated, gamesProcessed: upcomingGames.length };
}

// ─── CLI entrypoint ───────────────────────────────────────────────────────────

// Only run as script when called directly (not when imported by graph)
const isMain = process.argv[1]?.endsWith("score-confidence.ts") ||
               process.argv[1]?.endsWith("score-confidence.js");

if (isMain) {
  runConfidenceScorer().then((r) => {
    console.log(`Scored ${r.scored} edges across ${r.gamesProcessed} games.`);
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
