import type { MarketType, Sportsbook } from "./odds.js";

export type PickResult = "win" | "loss" | "push" | "pending";

export type PickConfidence = "lock" | "lean" | "play";

export interface TrackedPick {
  id: string;
  accountId: string;
  gameId: string;
  postUrl: string | null;
  postContent: string | null;
  sport: string;
  betType: MarketType | "parlay";
  betLabel: string; // "Chiefs -6.5"
  oddsAtPost: number;
  closingOdds: number | null;
  postedAt: string; // IMMUTABLE — never updated
  result: PickResult;
  unitsReturned: number | null;
  clv: number | null; // closing line value
  verifiedAt: string | null;
  createdAt: string;
}

export interface ExtractedPick {
  hasPick: boolean;
  sport: string | null;
  game: string | null;
  betType: MarketType | "parlay" | null;
  betLabel: string | null;
  odds: number | null;
  confidence: PickConfidence | null;
}

export interface PickTimeline {
  accountId: string;
  picks: Array<
    TrackedPick & {
      gameHomeTeam: string;
      gameAwayTeam: string;
      gameTime: string;
    }
  >;
  totalCount: number;
  cursor: string | null;
}

export interface FraudAlert {
  accountId: string;
  handle: string;
  platform: string;
  claimedRoi: number;
  verifiedRoi: number;
  discrepancy: number;
  reason: string;
  detectedAt: string;
  sportsbook: Sportsbook | null;
}
