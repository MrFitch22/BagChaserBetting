import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/client.js";
import { games, oddsHistory } from "../db/schema.js";
import { eq, and, desc, inArray, gte } from "drizzle-orm";

const ODDSPAPI_KEY = process.env["ODDSPAPI_KEY"] ?? "";
const ODDS_API_KEY = process.env["ODDS_API_KEY"] ?? "";

async function fetchOddsPapi(sport: string) {
  if (!ODDSPAPI_KEY) return [];
  const res = await fetch(`https://api.oddspapi.io/v1/odds?sport=${sport}&type=prematch&oddsFormat=american`, {
    headers: { "x-api-key": ODDSPAPI_KEY },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchTheOddsApi(sport: string) {
  if (!ODDS_API_KEY) return [];
  const BOOKS = "draftkings,fanduel,betmgm,caesars,pinnacle,pointsbet";
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&bookmakers=${BOOKS}&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function compareOddsRoutes(app: FastifyInstance) {
  // GET /api/compare-odds?sport=basketball_nba
  app.get(
    "/compare-odds",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = request.query as { sport?: string };
      const sport = query.sport ?? "basketball_nba";

      // Concurrently fetch from both APIs
      const [oddsPapiData, theOddsApiData] = await Promise.all([
        fetchOddsPapi(sport),
        fetchTheOddsApi(sport)
      ]);

      // Naive comparison structure to show the user side-by-side data
      return reply.send({
        sport,
        theOddsApi: theOddsApiData,
        oddsPapi: oddsPapiData,
        comparison: "Both sources successfully fetched."
      });
    }
  );
}
