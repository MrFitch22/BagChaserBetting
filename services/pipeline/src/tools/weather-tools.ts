/**
 * Weather signal tools — OpenWeatherMap free tier (no key needed for basic).
 *
 * Why weather matters for betting:
 *   NFL totals:  Wind > 15mph → Under signal. Rain/snow → Under signal.
 *   MLB totals:  Wind blowing out (Wrigley-style) → Over. In → Under.
 *   NBA/NHL:     Indoor — weather irrelevant (signal skipped).
 *
 * Free endpoint: api.openweathermap.org/data/2.5/weather
 * API key required (free tier: 1000 calls/day — more than enough).
 */
import type { AgentTool } from "../lib/run-agent.js";

const WEATHER_KEY  = process.env["OPENWEATHER_API_KEY"] ?? "";
const WEATHER_BASE = "https://api.openweathermap.org/data/2.5";

// ─── Venue → city mapping ─────────────────────────────────────────────────────
// Outdoor venues only — indoor venues are filtered out before calling weather.

const OUTDOOR_VENUES: Record<string, { city: string; lat: number; lon: number }> = {
  // NFL stadiums (outdoor)
  "Lambeau Field":            { city: "Green Bay, WI",       lat: 44.5013, lon: -88.0622 },
  "Highmark Stadium":         { city: "Orchard Park, NY",    lat: 42.7738, lon: -78.7870 },
  "Arrowhead Stadium":        { city: "Kansas City, MO",     lat: 39.0490, lon: -94.4839 },
  "Empower Field":            { city: "Denver, CO",          lat: 39.7439, lon: -105.0201 },
  "Levi's Stadium":           { city: "Santa Clara, CA",     lat: 37.4033, lon: -121.9694 },
  "Lincoln Financial Field":  { city: "Philadelphia, PA",    lat: 39.9008, lon: -75.1675 },
  "MetLife Stadium":          { city: "East Rutherford, NJ", lat: 40.8128, lon: -74.0742 },
  "Gillette Stadium":         { city: "Foxborough, MA",      lat: 42.0909, lon: -71.2643 },
  "M&T Bank Stadium":         { city: "Baltimore, MD",       lat: 39.2781, lon: -76.6227 },
  "Acrisure Stadium":         { city: "Pittsburgh, PA",      lat: 40.4468, lon: -80.0158 },
  "FedExField":               { city: "Landover, MD",        lat: 38.9078, lon: -76.8645 },
  "Soldier Field":            { city: "Chicago, IL",         lat: 41.8623, lon: -87.6167 },
  "Nissan Stadium":           { city: "Nashville, TN",       lat: 36.1665, lon: -86.7713 },
  "Huntington Bank Field":    { city: "Cleveland, OH",       lat: 41.5061, lon: -81.6995 },
  "Paycor Stadium":           { city: "Cincinnati, OH",      lat: 39.0955, lon: -84.5160 },
  // MLB ballparks (outdoor — many are outdoors, some have roofs)
  "Wrigley Field":            { city: "Chicago, IL",         lat: 41.9484, lon: -87.6553 },
  "Fenway Park":              { city: "Boston, MA",          lat: 42.3467, lon: -71.0972 },
  "Yankee Stadium":           { city: "Bronx, NY",           lat: 40.8296, lon: -73.9262 },
  "Dodger Stadium":           { city: "Los Angeles, CA",     lat: 34.0739, lon: -118.2400 },
  "Oracle Park":              { city: "San Francisco, CA",   lat: 37.7786, lon: -122.3893 },
  "Camden Yards":             { city: "Baltimore, MD",       lat: 39.2839, lon: -76.6216 },
  "PNC Park":                 { city: "Pittsburgh, PA",      lat: 40.4469, lon: -80.0057 },
  "Busch Stadium":            { city: "St. Louis, MO",       lat: 38.6226, lon: -90.1928 },
  "Great American Ball Park": { city: "Cincinnati, OH",      lat: 39.0974, lon: -84.5079 },
  "Progressive Field":        { city: "Cleveland, OH",       lat: 41.4962, lon: -81.6852 },
  "Guaranteed Rate Field":    { city: "Chicago, IL",         lat: 41.8300, lon: -87.6339 },
  "Target Field":             { city: "Minneapolis, MN",     lat: 44.9817, lon: -93.2781 },
  "Kauffman Stadium":         { city: "Kansas City, MO",     lat: 39.0516, lon: -94.4803 },
  "Coors Field":              { city: "Denver, CO",          lat: 39.7559, lon: -104.9942 },
  "Citizens Bank Park":       { city: "Philadelphia, PA",    lat: 39.9057, lon: -75.1665 },
  "Comerica Park":            { city: "Detroit, MI",         lat: 42.3390, lon: -83.0485 },
};

// ─── Weather → betting signal converter ───────────────────────────────────────

export interface WeatherSignal {
  venueName:      string;
  city:           string;
  tempF:          number;
  windSpeedMph:   number;
  windDirection:  string;
  condition:      string;   // "clear", "rain", "snow", "clouds"
  isOutdoor:      boolean;

  // Betting signal interpretation
  totalSignal:    number;   // 0..100 — 50=neutral, <50=Under lean, >50=Over lean
  hasSignal:      boolean;  // false if indoor or no meaningful weather factor
  explanation:    string;   // plain English for the narrative
}

function mphFromMs(ms: number): number { return ms * 2.237; }
function kelvinToF(k: number): number  { return (k - 273.15) * 9/5 + 32; }
function degreeToCompass(deg: number): string {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "N";
}

export async function getWeatherForVenue(venueName: string): Promise<WeatherSignal | null> {
  if (!WEATHER_KEY) return null;

  const venue = OUTDOOR_VENUES[venueName];
  if (!venue) return null; // indoor or unmapped venue

  const url = `${WEATHER_BASE}/weather?lat=${venue.lat}&lon=${venue.lon}&appid=${WEATHER_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;

    const data = await res.json() as {
      main:    { temp: number; feels_like: number };
      wind:    { speed: number; deg: number };
      weather: Array<{ main: string; description: string }>;
    };

    const tempF        = kelvinToF(data.main.temp);
    const windMph      = mphFromMs(data.wind.speed);
    const condition    = (data.weather[0]?.main ?? "Clear").toLowerCase();
    const windDir      = degreeToCompass(data.wind.deg ?? 0);

    // ── Convert to betting signal ──────────────────────────────────────────
    // Start neutral (50), then adjust for weather factors.
    let signal = 50;
    const factors: string[] = [];

    // Wind is the #1 factor for scoring (especially NFL totals)
    if (windMph >= 25) {
      signal -= 20;
      factors.push(`strong wind ${windMph.toFixed(0)}mph`);
    } else if (windMph >= 15) {
      signal -= 10;
      factors.push(`wind ${windMph.toFixed(0)}mph`);
    } else if (windMph >= 10) {
      signal -= 4;
      factors.push(`light wind ${windMph.toFixed(0)}mph`);
    }

    // Precipitation
    if (condition.includes("snow")) {
      signal -= 12;
      factors.push("snow");
    } else if (condition.includes("rain") || condition.includes("drizzle") || condition.includes("thunderstorm")) {
      signal -= 8;
      factors.push(condition);
    }

    // Cold temperature
    if (tempF < 20) {
      signal -= 8;
      factors.push(`very cold ${tempF.toFixed(0)}°F`);
    } else if (tempF < 32) {
      signal -= 4;
      factors.push(`freezing ${tempF.toFixed(0)}°F`);
    }

    const clampedSignal = Math.max(0, Math.min(100, signal));
    const hasSignal     = Math.abs(clampedSignal - 50) >= 5;
    const explanation   = hasSignal
      ? `Weather at ${venueName}: ${factors.join(", ")} — ${clampedSignal < 50 ? "lean Under" : "no lean"}`
      : `Weather at ${venueName}: conditions neutral for scoring`;

    return {
      venueName, city: venue.city, tempF, windSpeedMph: windMph,
      windDirection: windDir, condition, isOutdoor: true,
      totalSignal: clampedSignal, hasSignal, explanation,
    };
  } catch {
    return null;
  }
}

// ─── AgentTool wrapper ────────────────────────────────────────────────────────

export const getGameWeather: AgentTool = {
  definition: {
    name: "get_game_weather",
    description: `Get weather conditions for an outdoor game venue. Returns a betting signal for NFL/MLB totals.
Wind > 15mph and/or precipitation = Under signal. Indoor venues return hasSignal=false.
Only affects totals bets — not spreads or moneylines.`,
    input_schema: {
      type: "object" as const,
      properties: {
        venueName: { type: "string", description: "Stadium/ballpark name e.g. 'Lambeau Field'" },
      },
      required: ["venueName"],
    },
  },
  execute: async ({ venueName }: { venueName: string }) => {
    return getWeatherForVenue(venueName) ?? { venueName, hasSignal: false, explanation: "Venue not found or indoor" };
  },
};
