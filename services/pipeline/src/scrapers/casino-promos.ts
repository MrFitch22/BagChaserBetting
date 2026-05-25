/**
 * Casino promo scraper — cheerio-based (static HTML).
 * Scrapes bonus aggregator pages for casino offers.
 * Populates casinoPromos table.
 */
import * as cheerio from "cheerio";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../api/src/db/schema.js";

// Top online casinos with DK/FD/BetMGM casino arms + others
const CASINO_SOURCES: Array<{
  casino: string;
  url: string;
  parse: (html: string) => Array<{
    title: string;
    description?: string;
    promoType?: string;
    value?: string;
    url?: string;
    rating?: number;
  }>;
}> = [
  {
    casino: "DraftKings Casino",
    url: "https://casino.draftkings.com/promotions",
    parse: (html) => {
      const $ = cheerio.load(html);
      const results: ReturnType<typeof CASINO_SOURCES[0]["parse"]> = [];
      $('[class*="promo"], [class*="promotion"], [class*="offer"]').each((_, el) => {
        const title = $(el).find('h2, h3, [class*="title"]').first().text().trim();
        const desc  = $(el).find('p, [class*="description"]').first().text().trim();
        const val   = $(el).find('[class*="bonus"], [class*="value"], [class*="amount"]').first().text().trim();
        if (title.length > 3) {
          results.push({ title, description: desc || undefined, value: val || undefined, promoType: classifyType(title, desc) });
        }
      });
      return results;
    },
  },
  {
    casino: "FanDuel Casino",
    url: "https://casino.fanduel.com/promotions",
    parse: (html) => {
      const $ = cheerio.load(html);
      const results: ReturnType<typeof CASINO_SOURCES[0]["parse"]> = [];
      $('[class*="PromoCard"], [class*="promo-card"], [class*="offer"]').each((_, el) => {
        const title = $(el).find('h2, h3, [class*="title"]').first().text().trim();
        const desc  = $(el).find('p, [class*="description"]').first().text().trim();
        const val   = $(el).find('[class*="bonus"], [class*="value"]').first().text().trim();
        if (title.length > 3) {
          results.push({ title, description: desc || undefined, value: val || undefined, promoType: classifyType(title, desc) });
        }
      });
      return results;
    },
  },
  {
    casino: "BetMGM Casino",
    url: "https://casino.betmgm.com/en/casino/promotions",
    parse: (html) => {
      const $ = cheerio.load(html);
      const results: ReturnType<typeof CASINO_SOURCES[0]["parse"]> = [];
      $('[class*="promotion"], [class*="promo"], [class*="offer-card"]').each((_, el) => {
        const title = $(el).find('h2, h3, [class*="name"], [class*="title"]').first().text().trim();
        const desc  = $(el).find('p, [class*="description"]').first().text().trim();
        const val   = $(el).find('[class*="value"], [class*="bonus"]').first().text().trim();
        if (title.length > 3) {
          results.push({ title, description: desc || undefined, value: val || undefined, promoType: classifyType(title, desc) });
        }
      });
      return results;
    },
  },
  {
    casino: "Caesars Palace Online Casino",
    url: "https://casino.caesars.com/us/nj/promotions",
    parse: (html) => {
      const $ = cheerio.load(html);
      const results: ReturnType<typeof CASINO_SOURCES[0]["parse"]> = [];
      $('[class*="promo"], [class*="promotion"]').each((_, el) => {
        const title = $(el).find('h2, h3, [class*="title"]').first().text().trim();
        const desc  = $(el).find('p, [class*="description"], [class*="text"]').first().text().trim();
        const val   = $(el).find('[class*="bonus"], [class*="value"]').first().text().trim();
        if (title.length > 3) {
          results.push({ title, description: desc || undefined, value: val || undefined, promoType: classifyType(title, desc) });
        }
      });
      return results;
    },
  },
  {
    casino: "Hard Rock Bet Casino",
    url: "https://www.hardrock.bet/casino/promotions",
    parse: (html) => {
      const $ = cheerio.load(html);
      const results: ReturnType<typeof CASINO_SOURCES[0]["parse"]> = [];
      $('[class*="promo"], [class*="promotion"], [class*="offer"]').each((_, el) => {
        const title = $(el).find('h2, h3, [class*="title"]').first().text().trim();
        const desc  = $(el).find('p, [class*="description"]').first().text().trim();
        const val   = $(el).find('[class*="bonus"], [class*="value"], [class*="amount"]').first().text().trim();
        if (title.length > 3) {
          results.push({ title, description: desc || undefined, value: val || undefined, promoType: classifyType(title, desc) });
        }
      });
      return results;
    },
  },
];

function classifyType(title: string, description = ""): string {
  const text = (title + " " + description).toLowerCase();
  if (text.includes("welcome") || text.includes("first deposit") || text.includes("sign up")) return "welcome_bonus";
  if (text.includes("free spin") || text.includes("free play")) return "free_spins";
  if (text.includes("reload") || text.includes("weekly") || text.includes("daily")) return "reload";
  if (text.includes("cashback") || text.includes("cash back") || text.includes("rebate")) return "cashback";
  if (text.includes("deposit match") || text.includes("match bonus")) return "welcome_bonus";
  return "other";
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function runCasinoPromoScraper(db: ReturnType<typeof drizzle>): Promise<{
  casinosScraped: number;
  recordsWritten: number;
}> {
  let casinosScraped = 0;
  let recordsWritten = 0;

  for (const source of CASINO_SOURCES) {
    let html: string;
    try {
      html = await fetchHtml(source.url);
    } catch (err) {
      console.warn(`[CasinoScraper] ${source.casino} fetch failed:`, (err as Error).message);
      continue;
    }

    let promos: ReturnType<typeof source.parse>;
    try {
      promos = source.parse(html).slice(0, 15);
    } catch (err) {
      console.warn(`[CasinoScraper] ${source.casino} parse failed:`, (err as Error).message);
      continue;
    }

    if (!promos.length) {
      console.warn(`[CasinoScraper] ${source.casino}: no promos parsed (page may require JS)`);
      continue;
    }

    const capturedAt = new Date().toISOString();
    const records: Array<typeof schema.casinoPromos.$inferInsert> = promos.map((p) => ({
      casino:      source.casino,
      title:       p.title.slice(0, 255),
      description: p.description?.slice(0, 1000) ?? null,
      promoType:   p.promoType ?? "other",
      value:       p.value?.slice(0, 127) ?? null,
      url:         (p.url ?? source.url).slice(0, 511),
      rating:      p.rating?.toFixed(1) ?? null,
      capturedAt,
    }));

    await (db as ReturnType<typeof drizzle<typeof schema>>)
      .insert(schema.casinoPromos)
      .values(records);

    recordsWritten += records.length;
    casinosScraped++;
    console.log(`[CasinoScraper] ${source.casino}: ${records.length} promos`);
  }

  return { casinosScraped, recordsWritten };
}
