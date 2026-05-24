import type { MarketType } from "./odds.js";

export interface ConfidenceSignals {
  playerTrend: number; // 0–100
  sharpMoney: number; // -50 to +50
  sentiment: number; // 0–100
  scheduleEdge: number; // 0–100
  pickTracker: number; // 0–100
  matchup: number; // 0–100
}

export interface ConfidenceScore {
  id: string;
  gameId: string;
  market: MarketType;
  label: string;
  score: number; // 0–100 composite
  signals: ConfidenceSignals;
  modelVersion: string;
  computedAt: string;
}

export interface EdgeCard {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string;
  market: MarketType;
  label: string;
  odds: number;
  confidence: ConfidenceScore;
  isSharpMove: boolean;
  sharpDirection: "home" | "away" | null;
}

export interface SharpMoveAlert {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  market: MarketType;
  label: string;
  priceBefore: number;
  priceAfter: number;
  detectedAt: string;
  books: string[];
}
