import type { MarketType, Sportsbook } from "./odds";

export interface ParlayLeg {
  gameId: string;
  market: MarketType;
  label: string; // "Chiefs -6.5"
  odds: number; // American odds
  point: number | null;
  // enriched after probability calc
  adjustedProbability?: number;
  bookImpliedProbability?: number;
}

export interface ParlayResult {
  legs: ParlayLeg[];
  adjustedProbability: number; // our model's combined prob
  bookImpliedProbability: number; // raw book implied
  edgeScore: number; // positive = we have edge
  payoutOdds: number; // American odds for full parlay
  expectedValue: number; // per $100 wagered
}

export interface SavedParlay {
  id: string;
  userId: string;
  legs: ParlayLeg[];
  combinedProb: number;
  bookImplied: number;
  edgeScore: number;
  payoutOdds: number;
  status: "saved" | "placed" | "won" | "lost";
  sportsbook: Sportsbook | null;
  placedAt: string | null;
  createdAt: string;
}

export interface LiveParlayUpdate {
  parlayId: string;
  legs: Array<{
    gameId: string;
    label: string;
    currentProbability: number;
    status: "pending" | "winning" | "losing" | "won" | "lost" | "push";
  }>;
  combinedProbability: number;
}
