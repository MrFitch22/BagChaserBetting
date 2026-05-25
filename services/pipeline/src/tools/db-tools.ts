import type Anthropic from "@anthropic-ai/sdk";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, schema } from "../lib/db.js";
import type { AgentTool } from "../lib/run-agent.js";

// ─── Games ───────────────────────────────────────────────────────────────────

export const getUpcomingGames: AgentTool = {
  definition: {
    name: "get_upcoming_games",
    description: "Fetch games scheduled in the next N hours from the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        hours: { type: "number", description: "Look-ahead window in hours (default 48)" },
        sport: { type: "string", description: "Filter by sport (NFL|NBA|MLB|NHL). Omit for all." },
      },
      required: [],
    },
  },
  execute: async ({ hours = 48, sport }: { hours?: number; sport?: string }) => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + hours * 3_600_000);
    const rows = await db.query.games.findMany({
      where: and(
        gte(schema.games.gameTime, now.toISOString()),
        lte(schema.games.gameTime, cutoff.toISOString()),
        sport ? eq(schema.games.sport, sport) : undefined
      ),
      orderBy: schema.games.gameTime,
      limit: 100,
    });
    return rows;
  },
};

export const upsertGame: AgentTool = {
  definition: {
    name: "upsert_game",
    description: "Insert or update a game record by its external_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        externalId: { type: "string" },
        sport:      { type: "string" },
        league:     { type: "string" },
        homeTeam:   { type: "string" },
        awayTeam:   { type: "string" },
        gameTime:   { type: "string", description: "ISO 8601 timestamp" },
        venue:      { type: "string" },
        status:     { type: "string", enum: ["scheduled", "live", "final", "postponed"] },
        homeScore:  { type: "number" },
        awayScore:  { type: "number" },
      },
      required: ["externalId", "sport", "league", "homeTeam", "awayTeam", "gameTime"],
    },
  },
  execute: async (input: {
    externalId: string; sport: string; league: string;
    homeTeam: string; awayTeam: string; gameTime: string;
    venue?: string; status?: string; homeScore?: number; awayScore?: number;
  }) => {
    const result = await db
      .insert(schema.games)
      .values({ ...input, status: input.status ?? "scheduled" })
      .onConflictDoUpdate({
        target: schema.games.externalId,
        set: {
          status:    input.status ?? "scheduled",
          homeScore: input.homeScore,
          awayScore: input.awayScore,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({ id: schema.games.id });
    return result[0];
  },
};

// ─── Odds ────────────────────────────────────────────────────────────────────

export const writeOddsRecord: AgentTool = {
  definition: {
    name: "write_odds_record",
    description: "Write a single odds snapshot to odds_history.",
    input_schema: {
      type: "object" as const,
      properties: {
        gameId:    { type: "string" },
        book:      { type: "string" },
        market:    { type: "string" },
        label:     { type: "string" },
        price:     { type: "number", description: "American odds integer e.g. -110" },
        point:     { type: "number", description: "Spread or total value" },
        isOpening: { type: "boolean" },
      },
      required: ["gameId", "book", "market", "price"],
    },
  },
  execute: async (input: {
    gameId: string; book: string; market: string;
    label?: string; price: number; point?: number; isOpening?: boolean;
  }) => {
    await db.insert(schema.oddsHistory).values({
      gameId:    input.gameId,
      book:      input.book,
      market:    input.market,
      label:     input.label,
      price:     input.price,
      point:     input.point?.toString(),
      isOpening: input.isOpening ?? false,
    });
    return { written: true };
  },
};

export const writeOddsBatch: AgentTool = {
  definition: {
    name: "write_odds_batch",
    description: "Write multiple odds records in one transaction. Prefer this over repeated write_odds_record calls.",
    input_schema: {
      type: "object" as const,
      properties: {
        records: {
          type: "array",
          items: {
            type: "object",
            properties: {
              gameId:    { type: "string" },
              book:      { type: "string" },
              market:    { type: "string" },
              label:     { type: "string" },
              price:     { type: "number" },
              point:     { type: "number" },
              isOpening: { type: "boolean" },
            },
            required: ["gameId", "book", "market", "price"],
          },
          description: "Array of odds records to insert",
        },
      },
      required: ["records"],
    },
  },
  execute: async ({ records }: {
    records: Array<{
      gameId: string; book: string; market: string;
      label?: string; price: number; point?: number; isOpening?: boolean;
    }>;
  }) => {
    if (!records.length) return { written: 0 };
    await db.insert(schema.oddsHistory).values(
      records.map((r) => ({
        gameId:    r.gameId,
        book:      r.book,
        market:    r.market,
        label:     r.label,
        price:     r.price,
        point:     r.point?.toString(),
        isOpening: r.isOpening ?? false,
      }))
    );
    return { written: records.length };
  },
};

// ─── Social accounts + picks ──────────────────────────────────────────────────

export const upsertSocialAccount: AgentTool = {
  definition: {
    name: "upsert_social_account",
    description: "Create or update a social media account record.",
    input_schema: {
      type: "object" as const,
      properties: {
        handle:     { type: "string" },
        platform:   { type: "string", enum: ["twitter", "instagram", "tiktok"] },
        profileUrl: { type: "string" },
        followers:  { type: "number" },
      },
      required: ["handle", "platform"],
    },
  },
  execute: async (input: { handle: string; platform: string; profileUrl?: string; followers?: number }) => {
    const result = await db
      .insert(schema.socialAccounts)
      .values({
        handle:     input.handle,
        platform:   input.platform,
        profileUrl: input.profileUrl,
        followers:  input.followers ?? 0,
        lastActive: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [schema.socialAccounts.handle, schema.socialAccounts.platform],
        set: {
          followers:  input.followers,
          lastActive: new Date().toISOString(),
        },
      })
      .returning({ id: schema.socialAccounts.id });
    return result[0];
  },
};

export const writeTrackedPick: AgentTool = {
  definition: {
    name: "write_tracked_pick",
    description: "Record an extracted pick from a social post. postedAt is IMMUTABLE — set it to the original post timestamp.",
    input_schema: {
      type: "object" as const,
      properties: {
        accountId:   { type: "string" },
        gameId:      { type: "string" },
        postUrl:     { type: "string" },
        postContent: { type: "string" },
        sport:       { type: "string" },
        betType:     { type: "string" },
        betLabel:    { type: "string" },
        oddsAtPost:  { type: "number" },
        postedAt:    { type: "string", description: "ISO timestamp of original post — IMMUTABLE" },
      },
      required: ["accountId", "betLabel", "postedAt"],
    },
  },
  execute: async (input: {
    accountId: string; gameId?: string; postUrl?: string; postContent?: string;
    sport?: string; betType?: string; betLabel: string; oddsAtPost?: number; postedAt: string;
  }) => {
    const result = await db
      .insert(schema.trackedPicks)
      .values({ ...input, result: "pending" })
      .returning({ id: schema.trackedPicks.id });
    return result[0];
  },
};

export const getPendingPicks: AgentTool = {
  definition: {
    name: "get_pending_picks",
    description: "Fetch all picks with result='pending' that have a linked game.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max records to return (default 100)" },
      },
      required: [],
    },
  },
  execute: async ({ limit = 100 }: { limit?: number }) => {
    const rows = await db
      .select({
        pick: schema.trackedPicks,
        game: schema.games,
        account: {
          id:     schema.socialAccounts.id,
          handle: schema.socialAccounts.handle,
        },
      })
      .from(schema.trackedPicks)
      .innerJoin(schema.games, eq(schema.trackedPicks.gameId, schema.games.id))
      .innerJoin(schema.socialAccounts, eq(schema.trackedPicks.accountId, schema.socialAccounts.id))
      .where(eq(schema.trackedPicks.result, "pending"))
      .limit(limit);
    return rows;
  },
};

export const updatePickResult: AgentTool = {
  definition: {
    name: "update_pick_result",
    description: "Set the final result on a tracked pick and record closing odds.",
    input_schema: {
      type: "object" as const,
      properties: {
        pickId:       { type: "string" },
        result:       { type: "string", enum: ["win", "loss", "push"] },
        closingOdds:  { type: "number" },
        unitsReturned:{ type: "number" },
        clv:          { type: "number", description: "Closing line value" },
      },
      required: ["pickId", "result"],
    },
  },
  execute: async (input: {
    pickId: string; result: string; closingOdds?: number;
    unitsReturned?: number; clv?: number;
  }) => {
    await db
      .update(schema.trackedPicks)
      .set({
        result:        input.result,
        closingOdds:   input.closingOdds,
        unitsReturned: input.unitsReturned?.toString(),
        clv:           input.clv?.toString(),
        verifiedAt:    new Date().toISOString(),
      })
      .where(eq(schema.trackedPicks.id, input.pickId));
    return { updated: true };
  },
};

export const recalculateAccountStats: AgentTool = {
  definition: {
    name: "recalculate_account_stats",
    description: "Recompute W/L/ROI for a social account from all their verified picks and update the record.",
    input_schema: {
      type: "object" as const,
      properties: {
        accountId: { type: "string" },
      },
      required: ["accountId"],
    },
  },
  execute: async ({ accountId }: { accountId: string }) => {
    const picks = await db.query.trackedPicks.findMany({
      where: and(
        eq(schema.trackedPicks.accountId, accountId),
        inArray(schema.trackedPicks.result, ["win", "loss", "push"])
      ),
      columns: { result: true, unitsReturned: true },
    });

    const wins   = picks.filter((p) => p.result === "win").length;
    const losses = picks.filter((p) => p.result === "loss").length;
    const totalUnitsWagered = wins + losses; // 1 unit per pick
    const unitsWon = picks.reduce(
      (sum, p) => sum + (p.unitsReturned ? parseFloat(p.unitsReturned) : 0),
      0
    );
    const roi = totalUnitsWagered > 0
      ? ((unitsWon - totalUnitsWagered) / totalUnitsWagered) * 100
      : null;

    await db
      .update(schema.socialAccounts)
      .set({
        verifiedW:   wins,
        verifiedL:   losses,
        verifiedRoi: roi?.toString(),
      })
      .where(eq(schema.socialAccounts.id, accountId));

    return { wins, losses, roi };
  },
};

// ─── Sentiment ───────────────────────────────────────────────────────────────

export const writeSentimentScore: AgentTool = {
  definition: {
    name: "write_sentiment_score",
    description: "Store a computed sentiment score for a player or team.",
    input_schema: {
      type: "object" as const,
      properties: {
        entityType:    { type: "string", enum: ["player", "team"] },
        entityId:      { type: "string" },
        score:         { type: "number", description: "-1.0 (very negative) to 1.0 (very positive)" },
        injuryConcern: { type: "number", description: "0 to 1, higher = more injured/concerning" },
        motivation:    { type: "number", description: "0 to 1, higher = more motivated" },
        sourceCount:   { type: "number" },
      },
      required: ["entityType", "entityId", "score"],
    },
  },
  execute: async (input: {
    entityType: string; entityId: string; score: number;
    injuryConcern?: number; motivation?: number; sourceCount?: number;
  }) => {
    await db.insert(schema.sentimentScores).values({
      entityType:    input.entityType,
      entityId:      input.entityId,
      score:         input.score.toString(),
      injuryConcern: input.injuryConcern?.toString(),
      motivation:    input.motivation?.toString(),
      sourceCount:   input.sourceCount,
    });
    return { written: true };
  },
};
