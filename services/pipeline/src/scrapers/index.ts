/**
 * Scraper runner — called by pipeline scheduler.
 * Runs all scrapers in sequence and reports results.
 */
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(resolve(__dirname, "../../../../.env.local"));
} catch { /* ignore */ }

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../../api/src/db/schema.js";
import { runActionNetworkScraper } from "./action-network.js";
import { runCoversScraper } from "./covers-scraper.js";
import { runSportsbookPromoScraper } from "./sportsbook-promos.js";
import { runCasinoPromoScraper } from "./casino-promos.js";

export async function runAllScrapers(db: ReturnType<typeof drizzle>): Promise<void> {
  console.log("[Scrapers] Starting scraper run...");

  // Public betting % — two sources for cross-validation
  try {
    const { gamesProcessed, recordsWritten } = await runActionNetworkScraper(db);
    console.log(`[Scrapers] Action Network: ${gamesProcessed} games, ${recordsWritten} records`);
  } catch (err) {
    console.error("[Scrapers] Action Network failed:", (err as Error).message);
  }

  try {
    const { gamesProcessed, recordsWritten } = await runCoversScraper(db);
    console.log(`[Scrapers] Covers.com: ${gamesProcessed} games, ${recordsWritten} records`);
  } catch (err) {
    console.error("[Scrapers] Covers.com failed:", (err as Error).message);
  }

  // Sportsbook promos
  try {
    const { booksScraped, recordsWritten } = await runSportsbookPromoScraper(db);
    console.log(`[Scrapers] Sportsbook promos: ${booksScraped} books, ${recordsWritten} records`);
  } catch (err) {
    console.error("[Scrapers] Sportsbook promos failed:", (err as Error).message);
  }

  // Casino promos
  try {
    const { casinosScraped, recordsWritten } = await runCasinoPromoScraper(db);
    console.log(`[Scrapers] Casino promos: ${casinosScraped} casinos, ${recordsWritten} records`);
  } catch (err) {
    console.error("[Scrapers] Casino promos failed:", (err as Error).message);
  }

  console.log("[Scrapers] Done.");
}

// Standalone runner
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env["DATABASE_URL"], max: 3 });
  const db = drizzle(pool, { schema });

  runAllScrapers(db)
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => pool.end());
}
