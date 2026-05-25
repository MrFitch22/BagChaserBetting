import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  text,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// drizzle-orm <0.31 does not export `timestamptz`; use timestamp with withTimezone instead
const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

// ─── Core entities ────────────────────────────────────────────────────────────

export const players = pgTable("players", {
  id:          uuid("id").primaryKey().defaultRandom(),
  universalId: varchar("universal_id", { length: 64 }).unique().notNull(),
  name:        varchar("name", { length: 255 }).notNull(),
  sport:       varchar("sport", { length: 32 }).notNull(),
  team:        varchar("team", { length: 64 }),
  position:    varchar("position", { length: 32 }),
  status:      varchar("status", { length: 32 }).default("active").notNull(),
  createdAt:   timestamptz("created_at").defaultNow().notNull(),
  updatedAt:   timestamptz("updated_at").defaultNow().notNull(),
});

export const games = pgTable("games", {
  id:         uuid("id").primaryKey().defaultRandom(),
  externalId: varchar("external_id", { length: 64 }).unique().notNull(),
  sport:      varchar("sport", { length: 32 }).notNull(),
  league:     varchar("league", { length: 32 }).notNull(),
  homeTeam:   varchar("home_team", { length: 64 }).notNull(),
  awayTeam:   varchar("away_team", { length: 64 }).notNull(),
  gameTime:   timestamptz("game_time").notNull(),
  venue:      varchar("venue", { length: 128 }),
  status:     varchar("status", { length: 32 }).default("scheduled").notNull(),
  homeScore:  integer("home_score"),
  awayScore:  integer("away_score"),
  createdAt:  timestamptz("created_at").defaultNow().notNull(),
  updatedAt:  timestamptz("updated_at").defaultNow().notNull(),
});

// ─── Odds history (TimescaleDB hypertable) ────────────────────────────────────

export const oddsHistory = pgTable("odds_history", {
  id:         uuid("id").defaultRandom().notNull(),
  gameId:     uuid("game_id").references(() => games.id),
  book:       varchar("book", { length: 64 }).notNull(),
  market:     varchar("market", { length: 64 }).notNull(),
  label:      varchar("label", { length: 128 }),
  price:      integer("price").notNull(),
  point:      numeric("point", { precision: 5, scale: 1 }),
  isOpening:  boolean("is_opening").default(false).notNull(),
  capturedAt: timestamptz("captured_at").defaultNow().notNull(),
});

// ─── Intelligence signals ─────────────────────────────────────────────────────

export const confidenceScores = pgTable("confidence_scores", {
  id:            uuid("id").primaryKey().defaultRandom(),
  gameId:        uuid("game_id").references(() => games.id),
  market:        varchar("market", { length: 64 }).notNull(),
  label:         varchar("label", { length: 128 }).notNull(),
  score:         numeric("score", { precision: 5, scale: 2 }).notNull(),
  playerTrend:   numeric("player_trend", { precision: 5, scale: 2 }),
  sharpMoney:    numeric("sharp_money", { precision: 5, scale: 2 }),
  sentiment:     numeric("sentiment", { precision: 5, scale: 2 }),
  scheduleEdge:  numeric("schedule_edge", { precision: 5, scale: 2 }),
  pickTracker:   numeric("pick_tracker", { precision: 5, scale: 2 }),
  matchup:       numeric("matchup", { precision: 5, scale: 2 }),
  publicMoney:   numeric("public_money",   { precision: 5, scale: 2 }),
  lineMovement:  numeric("line_movement",  { precision: 5, scale: 2 }),
  dataQuality:   numeric("data_quality",   { precision: 4, scale: 3 }),
  narrative:     text("narrative"),
  modelVersion:  varchar("model_version", { length: 32 }),
  computedAt:    timestamptz("computed_at").defaultNow().notNull(),
});

export const sentimentScores = pgTable("sentiment_scores", {
  id:            uuid("id").primaryKey().defaultRandom(),
  entityType:    varchar("entity_type", { length: 32 }).notNull(),
  entityId:      uuid("entity_id").notNull(),
  score:         numeric("score", { precision: 4, scale: 3 }),
  injuryConcern: numeric("injury_concern", { precision: 4, scale: 3 }),
  motivation:    numeric("motivation", { precision: 4, scale: 3 }),
  sourceCount:   integer("source_count"),
  computedAt:    timestamptz("computed_at").defaultNow().notNull(),
});

// ─── Pick tracker ─────────────────────────────────────────────────────────────

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    handle:        varchar("handle", { length: 128 }).notNull(),
    platform:      varchar("platform", { length: 32 }).notNull(),
    profileUrl:    varchar("profile_url", { length: 512 }),
    followers:     integer("followers").default(0).notNull(),
    tier:          varchar("tier", { length: 32 }).default("unverified").notNull(),
    trustScore:    numeric("trust_score", { precision: 5, scale: 2 }).default("0").notNull(),
    verifiedW:     integer("verified_w").default(0).notNull(),
    verifiedL:     integer("verified_l").default(0).notNull(),
    verifiedRoi:   numeric("verified_roi", { precision: 7, scale: 2 }),
    claimedRoi:    numeric("claimed_roi", { precision: 7, scale: 2 }),
    isFraud:       boolean("is_fraud").default(false).notNull(),
    trackingSince: timestamptz("tracking_since").defaultNow().notNull(),
    lastActive:    timestamptz("last_active"),
  },
  (t) => ({
    handlePlatformIdx: uniqueIndex("social_accounts_handle_platform").on(t.handle, t.platform),
  })
);

export const trackedPicks = pgTable(
  "tracked_picks",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    accountId:    uuid("account_id").references(() => socialAccounts.id),
    gameId:       uuid("game_id").references(() => games.id),
    postUrl:      varchar("post_url", { length: 512 }),
    postContent:  text("post_content"),
    sport:        varchar("sport", { length: 32 }),
    betType:      varchar("bet_type", { length: 64 }),
    betLabel:     varchar("bet_label", { length: 256 }),
    oddsAtPost:   integer("odds_at_post"),
    closingOdds:  integer("closing_odds"),
    postedAt:     timestamptz("posted_at").notNull(), // IMMUTABLE — never updated
    result:       varchar("result", { length: 16 }).default("pending").notNull(),
    unitsReturned: numeric("units_returned", { precision: 6, scale: 3 }),
    clv:          numeric("clv", { precision: 6, scale: 3 }),
    verifiedAt:   timestamptz("verified_at"),
    createdAt:    timestamptz("created_at").defaultNow().notNull(),
  },
  (t) => ({
    accountPostedIdx: index("idx_tracked_picks_account").on(t.accountId, t.postedAt),
    pendingIdx:       index("idx_tracked_picks_pending").on(t.result),
  })
);

// ─── Users and subscriptions ──────────────────────────────────────────────────

export const users = pgTable("users", {
  id:        uuid("id").primaryKey().defaultRandom(),
  clerkId:   varchar("clerk_id", { length: 128 }).unique().notNull(),
  email:     varchar("email", { length: 255 }).unique().notNull(),
  username:  varchar("username", { length: 64 }).unique(),
  tier:      varchar("tier", { length: 32 }).default("free").notNull(),
  stripeId:  varchar("stripe_id", { length: 128 }),
  createdAt: timestamptz("created_at").defaultNow().notNull(),
});

export const userParlays = pgTable("user_parlays", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").references(() => users.id),
  legs:         jsonb("legs").notNull(),
  combinedProb: numeric("combined_prob", { precision: 5, scale: 2 }),
  bookImplied:  numeric("book_implied", { precision: 5, scale: 2 }),
  edgeScore:    numeric("edge_score", { precision: 5, scale: 2 }),
  payoutOdds:   integer("payout_odds"),
  status:       varchar("status", { length: 32 }).default("saved").notNull(),
  sportsbook:   varchar("sportsbook", { length: 64 }),
  placedAt:     timestamptz("placed_at"),
  createdAt:    timestamptz("created_at").defaultNow().notNull(),
});

// ─── Scraper data ────────────────────────────────────────────────────────────

export const publicBettingData = pgTable("public_betting_data", {
  id:         uuid("id").primaryKey().defaultRandom(),
  gameId:     uuid("game_id").references(() => games.id),
  market:     varchar("market", { length: 64 }).notNull(),
  label:      varchar("label", { length: 128 }).notNull(),
  betsPct:    numeric("bets_pct",  { precision: 5, scale: 2 }), // % of bets placed on this side
  moneyPct:   numeric("money_pct", { precision: 5, scale: 2 }), // % of money wagered on this side
  source:     varchar("source",    { length: 64 }).notNull(),   // 'action_network' | 'covers'
  capturedAt: timestamptz("captured_at").defaultNow().notNull(),
});

export const bookPromos = pgTable("book_promos", {
  id:          uuid("id").primaryKey().defaultRandom(),
  book:        varchar("book",        { length: 64 }).notNull(),
  title:       varchar("title",       { length: 256 }).notNull(),
  description: text("description"),
  promoType:   varchar("promo_type",  { length: 64 }),  // 'odds_boost' | 'free_bet' | 'deposit_match' | 'parlay_insurance'
  value:       varchar("value",       { length: 128 }), // '$20 free bet', '25% SGP boost'
  url:         varchar("url",         { length: 512 }),
  expiresAt:   timestamptz("expires_at"),
  capturedAt:  timestamptz("captured_at").defaultNow().notNull(),
});

export const casinoPromos = pgTable("casino_promos", {
  id:          uuid("id").primaryKey().defaultRandom(),
  casino:      varchar("casino",      { length: 128 }).notNull(),
  title:       varchar("title",       { length: 256 }).notNull(),
  description: text("description"),
  promoType:   varchar("promo_type",  { length: 64 }),  // 'welcome_bonus' | 'free_spins' | 'reload'
  value:       varchar("value",       { length: 128 }),
  url:         varchar("url",         { length: 512 }),
  rating:      numeric("rating",      { precision: 3, scale: 1 }),
  capturedAt:  timestamptz("captured_at").defaultNow().notNull(),
});

// ─── Self-improvement engine ──────────────────────────────────────────────────

// Captures the system's top +EV predictions before each game starts.
// After the game, the result is written back — this is the training data
// the self-improvement engine uses to tune signal weights.
export const systemPredictions = pgTable(
  "system_predictions",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    gameId:         uuid("game_id").references(() => games.id).notNull(),
    market:         varchar("market",  { length: 64 }).notNull(),
    label:          varchar("label",   { length: 128 }).notNull(),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull(),
    // Raw signal values at prediction time — used for attribution analysis
    signalValues:   jsonb("signal_values").notNull(), // { sharpMoney: 72, sentiment: 61, ... }
    sport:          varchar("sport",   { length: 32 }).notNull(),
    predictedAt:    timestamptz("predicted_at").defaultNow().notNull(),
    // Filled after game ends
    result:         varchar("result",  { length: 16 }),  // 'win' | 'loss' | 'push'
    homeScore:      integer("home_score"),
    awayScore:      integer("away_score"),
    gradedAt:       timestamptz("graded_at"),
  },
  (t) => ({
    gameMarketIdx: index("idx_sys_pred_game").on(t.gameId, t.market, t.label),
    ungradedIdx:   index("idx_sys_pred_ungraded").on(t.result, t.predictedAt),
  })
);

// Dynamic signal weights per sport — updated nightly by the self-improvement engine.
// Seeded from the hardcoded SPORT_WEIGHTS on first run.
export const modelWeights = pgTable(
  "model_weights",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    sport:      varchar("sport",  { length: 32 }).notNull(), // 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'DEFAULT'
    signal:     varchar("signal", { length: 64 }).notNull(), // 'sharpMoney' | 'lineMovement' | ...
    weight:     numeric("weight", { precision: 6, scale: 4 }).notNull(),
    sampleSize: integer("sample_size").default(0).notNull(), // predictions used to derive this weight
    updatedAt:  timestamptz("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    sportSignalIdx: uniqueIndex("idx_model_weights_sport_signal").on(t.sport, t.signal),
  })
);

// ─── Affiliate tracking ───────────────────────────────────────────────────────

export const affiliateClicks = pgTable("affiliate_clicks", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").references(() => users.id),
  sportsbook:   varchar("sportsbook", { length: 64 }).notNull(),
  parlayId:     uuid("parlay_id").references(() => userParlays.id),
  clickedAt:    timestamptz("clicked_at").defaultNow().notNull(),
  converted:    boolean("converted").default(false).notNull(),
  conversionAt: timestamptz("conversion_at"),
});
