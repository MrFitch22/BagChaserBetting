// Re-export the shared DB client for use in API routes / webhooks
// In production, webhooks run in Next.js edge/Node runtime and need their own DB connection
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString: process.env["DATABASE_URL"] ?? "",
  max: 5, // smaller pool for Next.js serverless
});

export const db = drizzle(pool, { schema });
