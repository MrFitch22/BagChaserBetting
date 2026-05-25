import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../../api/src/db/schema.js";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({
  connectionString: process.env["DATABASE_URL"],
  max: 5,
});

export const db = drizzle(pool, { schema });
export { schema };
