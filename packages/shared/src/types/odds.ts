export type MarketType = "spread" | "moneyline" | "total" | "prop";

export type Sportsbook =
  | "draftkings"
  | "fanduel"
  | "betmgm"
  | "caesars"
  | "pinnacle"
  | "pointsbet"
  | "bet365";

export interface OddsLine {
  id: string;
  gameId: string;
  book: Sportsbook;
  market: MarketType;
  label: string; // "Chiefs -6.5" | "Over 48.5"
  price: number; // American odds e.g. -110
  point: number | null; // spread or total value
  isOpening: boolean;
  capturedAt: string;
}

export interface OddsMovement {
  gameId: string;
  market: MarketType;
  label: string;
  openingPrice: number;
  currentPrice: number;
  openingPoint: number | null;
  currentPoint: number | null;
  movementBps: number; // basis points of movement
  capturedAt: string;
}

export interface TopMovement {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  market: MarketType;
  label: string;
  book: Sportsbook;
  priceMoved: number;
  direction: "up" | "down";
  capturedAt: string;
}

/** Convert American odds to implied probability (0–1) */
export function americanToImplied(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Convert implied probability to American odds */
export function impliedToAmerican(prob: number): number {
  if (prob >= 0.5) return -Math.round((prob / (1 - prob)) * 100);
  return Math.round(((1 - prob) / prob) * 100);
}
