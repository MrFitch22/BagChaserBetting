export type GameStatus = "scheduled" | "live" | "final" | "postponed";

export type Sport = "NFL" | "NBA" | "MLB" | "NHL" | "NCAAF" | "NCAAB";

export interface Game {
  id: string;
  externalId: string;
  sport: Sport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: string; // ISO timestamp
  venue: string | null;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveGameUpdate {
  gameId: string;
  homeScore: number;
  awayScore: number;
  quarter?: number;
  period?: number;
  inning?: number;
  timeRemaining?: string;
  status: GameStatus;
}
