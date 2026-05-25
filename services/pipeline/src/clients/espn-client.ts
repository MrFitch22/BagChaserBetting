/**
 * ESPN Public API client — no auth required.
 * Covers: scoreboards, game summaries, injury reports, odds, win probability.
 *
 * Domains:
 *   site.api.espn.com       — scoreboards, teams, standings
 *   sports.core.api.espn.com — athletes, stats, odds, injuries (deep data)
 *
 * Sport/league slugs for the 4 major NA sports:
 *   NFL → sport=football,   league=nfl
 *   NBA → sport=basketball, league=nba
 *   MLB → sport=baseball,   league=mlb
 *   NHL → sport=hockey,     league=nhl
 */

const SITE_API  = "https://site.api.espn.com/apis/site/v2";
const CORE_API  = "https://sports.core.api.espn.com/v2";

const ESPN_UA   = "BagChaserBetting/1.0 (sports intelligence; contact: support@bagchaser.com)";

// Map our DB sport codes → ESPN sport/league slugs
export const ESPN_SPORT_MAP: Record<string, { sport: string; league: string }> = {
  NFL: { sport: "football",   league: "nfl" },
  NBA: { sport: "basketball", league: "nba" },
  MLB: { sport: "baseball",   league: "mlb" },
  NHL: { sport: "hockey",     league: "nhl" },
};

async function espnFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": ESPN_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EspnGame {
  id:         string;
  name:       string;
  shortName:  string;
  date:       string;
  status:     { type: { id: string; name: string; state: string; completed: boolean; description: string }; displayClock: string; period: number };
  homeTeam:   { id: string; displayName: string; score: number | null };
  awayTeam:   { id: string; displayName: string; score: number | null };
  venue:      string | null;
  odds:       { provider: string; details: string; overUnder: number | null; homeTeamOdds: { moneyLine: number | null } | null; awayTeamOdds: { moneyLine: number | null } | null } | null;
  winProbability: { homeWinPercentage: number | null; awayWinPercentage: number | null } | null;
}

export interface EspnInjury {
  athlete:   { id: string; displayName: string; position: string; jersey: string };
  team:      { id: string; displayName: string };
  status:    string; // "Out", "Doubtful", "Questionable", "Probable", "Day-To-Day"
  type:      string; // injury type e.g. "Knee"
  details:   string | null;
  date:      string | null;
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

export async function getScoreboard(sport: string, league: string, date?: string): Promise<EspnGame[]> {
  const dateParam = date ? `&dates=${date.replace(/-/g, "")}` : "";
  const url = `${SITE_API}/sports/${sport}/${league}/scoreboard?limit=50${dateParam}`;

  const data = await espnFetch<{
    events?: Array<{
      id: string;
      name: string;
      shortName: string;
      date: string;
      status: { type: { id: string; name: string; state: string; completed: boolean; description: string }; displayClock: string; period: number };
      competitions: Array<{
        competitors: Array<{
          homeAway: string;
          score: string;
          team: { id: string; displayName: string };
        }>;
        odds?: Array<{
          provider: { name: string };
          details: string;
          overUnder: number;
          homeTeamOdds: { moneyLine: number } | null;
          awayTeamOdds: { moneyLine: number } | null;
        }>;
        situation?: {
          homeWinPercentage?: number;
          awayWinPercentage?: number;
        };
      }>;
      venue?: { fullName: string };
    }>;
  }>(url);

  return (data.events ?? []).map((e): EspnGame => {
    const comp = e.competitions[0]!;
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    const odds = comp.odds?.[0] ?? null;
    const sit  = comp.situation;

    return {
      id:        e.id,
      name:      e.name,
      shortName: e.shortName,
      date:      e.date,
      status:    e.status,
      homeTeam:  { id: home?.team.id ?? "", displayName: home?.team.displayName ?? "", score: home?.score != null ? parseInt(home.score) : null },
      awayTeam:  { id: away?.team.id ?? "", displayName: away?.team.displayName ?? "", score: away?.score != null ? parseInt(away.score) : null },
      venue:     e.venue?.fullName ?? null,
      odds:      odds ? {
        provider:      odds.provider.name,
        details:       odds.details,
        overUnder:     odds.overUnder ?? null,
        homeTeamOdds:  odds.homeTeamOdds ?? null,
        awayTeamOdds:  odds.awayTeamOdds ?? null,
      } : null,
      winProbability: sit ? {
        homeWinPercentage: sit.homeWinPercentage ?? null,
        awayWinPercentage: sit.awayWinPercentage ?? null,
      } : null,
    };
  });
}

// ─── Game Summary (deep odds + win probability) ───────────────────────────────

export async function getGameSummary(sport: string, league: string, eventId: string): Promise<{
  winProbability: { homeWinPercentage: number | null; awayWinPercentage: number | null } | null;
  odds: { provider: string; spread: string | null; overUnder: number | null; homeML: number | null; awayML: number | null }[];
  injuries: EspnInjury[];
}> {
  const url = `${SITE_API}/sports/${sport}/${league}/summary?event=${eventId}`;

  const data = await espnFetch<{
    winprobability?: Array<{ homeWinPercentage: number; awayWinPercentage: number }>;
    pickcenter?: Array<{
      provider: { name: string };
      details: string;
      overUnder: number;
      homeTeamOdds: { moneyLine: number } | null;
      awayTeamOdds: { moneyLine: number } | null;
    }>;
    injuries?: Array<{
      team: { id: string; displayName: string };
      injuries: Array<{
        athlete: { id: string; displayName: string; position: { displayName: string }; jersey: string };
        status: string;
        type: { displayName: string };
        details?: { detail?: string; returnDate?: string };
        date?: string;
      }>;
    }>;
  }>(url);

  const latestWinProb = data.winprobability?.at(-1) ?? null;
  const injuries: EspnInjury[] = [];

  for (const teamGroup of data.injuries ?? []) {
    for (const inj of teamGroup.injuries) {
      injuries.push({
        athlete: {
          id:          inj.athlete.id,
          displayName: inj.athlete.displayName,
          position:    inj.athlete.position?.displayName ?? "Unknown",
          jersey:      inj.athlete.jersey ?? "",
        },
        team:    { id: teamGroup.team.id, displayName: teamGroup.team.displayName },
        status:  inj.status,
        type:    inj.type?.displayName ?? "Unknown",
        details: inj.details?.detail ?? null,
        date:    inj.date ?? null,
      });
    }
  }

  return {
    winProbability: latestWinProb
      ? { homeWinPercentage: latestWinProb.homeWinPercentage, awayWinPercentage: latestWinProb.awayWinPercentage }
      : null,
    odds: (data.pickcenter ?? []).map((o) => ({
      provider:  o.provider.name,
      spread:    o.details ?? null,
      overUnder: o.overUnder ?? null,
      homeML:    o.homeTeamOdds?.moneyLine ?? null,
      awayML:    o.awayTeamOdds?.moneyLine ?? null,
    })),
    injuries,
  };
}

// ─── League-wide injury report ────────────────────────────────────────────────
// Returns all active injuries across the league — useful for sentiment analysis

export async function getLeagueInjuries(sport: string, league: string): Promise<EspnInjury[]> {
  // Core API returns paginated $refs to individual injury objects
  // We use the site API summary endpoint per team instead — more reliable
  const url = `${CORE_API}/sports/${sport}/leagues/${league}/injuries?limit=300`;

  const data = await espnFetch<{
    items?: Array<{
      $ref?: string;
      athlete?: { $ref?: string; id?: string; displayName?: string; position?: { displayName?: string }; jersey?: string };
      team?:    { $ref?: string; id?: string; displayName?: string };
      status?:  string;
      type?:    { displayName?: string };
      details?: { detail?: string };
      date?:    string;
    }>;
  }>(url);

  const injuries: EspnInjury[] = [];
  for (const item of data.items ?? []) {
    if (!item.athlete?.displayName || !item.team?.displayName) continue;
    injuries.push({
      athlete: {
        id:          item.athlete.id ?? "",
        displayName: item.athlete.displayName,
        position:    item.athlete.position?.displayName ?? "Unknown",
        jersey:      item.athlete.jersey ?? "",
      },
      team:    { id: item.team.id ?? "", displayName: item.team.displayName },
      status:  item.status ?? "Unknown",
      type:    item.type?.displayName ?? "Unknown",
      details: item.details?.detail ?? null,
      date:    item.date ?? null,
    });
  }

  return injuries;
}

// ─── Game odds from Core API ──────────────────────────────────────────────────

export async function getGameOdds(sport: string, league: string, eventId: string): Promise<{
  provider: string;
  spread:   string | null;
  overUnder: number | null;
  homeML:    number | null;
  awayML:    number | null;
}[]> {
  const url = `${CORE_API}/sports/${sport}/leagues/${league}/events/${eventId}/competitions/${eventId}/odds`;

  const data = await espnFetch<{
    items?: Array<{
      provider?: { name?: string };
      details?:  string;
      overUnder?: number;
      homeTeamOdds?: { moneyLine?: number };
      awayTeamOdds?: { moneyLine?: number };
    }>;
  }>(url);

  return (data.items ?? []).map((o) => ({
    provider:  o.provider?.name ?? "Unknown",
    spread:    o.details ?? null,
    overUnder: o.overUnder ?? null,
    homeML:    o.homeTeamOdds?.moneyLine ?? null,
    awayML:    o.awayTeamOdds?.moneyLine ?? null,
  }));
}

// ─── Find game by team names (fuzzy match) ────────────────────────────────────
// Used when we only know team names but not the ESPN event ID

export async function findGame(
  sport: string, league: string,
  homeTeam: string, awayTeam: string,
  date?: string
): Promise<EspnGame | null> {
  const games = await getScoreboard(sport, league, date);
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const homeN = normalize(homeTeam);
  const awayN = normalize(awayTeam);

  return games.find((g) =>
    (normalize(g.homeTeam.displayName).includes(homeN) || homeN.includes(normalize(g.homeTeam.displayName))) &&
    (normalize(g.awayTeam.displayName).includes(awayN) || awayN.includes(normalize(g.awayTeam.displayName)))
  ) ?? null;
}
