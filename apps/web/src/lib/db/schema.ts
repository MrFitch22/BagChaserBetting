import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

// Minimal schema needed by Next.js webhook routes
export const users = pgTable("users", {
  id:        uuid("id").primaryKey().defaultRandom(),
  clerkId:   varchar("clerk_id", { length: 128 }).unique().notNull(),
  email:     varchar("email", { length: 255 }).unique().notNull(),
  username:  varchar("username", { length: 64 }).unique(),
  tier:      varchar("tier", { length: 32 }).default("free").notNull(),
  stripeId:  varchar("stripe_id", { length: 128 }),
  createdAt: timestamptz("created_at").defaultNow().notNull(),
});

export const affiliateClicks = pgTable("affiliate_clicks", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").references(() => users.id),
  sportsbook:   varchar("sportsbook", { length: 64 }).notNull(),
  parlayId:     uuid("parlay_id"),
  clickedAt:    timestamptz("clicked_at").defaultNow().notNull(),
  converted:    boolean("converted").default(false).notNull(),
  conversionAt: timestamptz("conversion_at"),
});
