/**
 * Sportsbook promo scraper — Playwright-based.
 * Visits each book's promotions page and extracts active offers.
 * Populates bookPromos table.
 */
import { chromium } from "playwright";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../api/src/db/schema.js";

const BOOKS: Array<{
  name: string;
  url: string;
  selectors: {
    container: string;
    title: string;
    description?: string;
    value?: string;
  };
}> = [
  {
    name: "draftkings",
    url: "https://sportsbook.draftkings.com/promotions",
    selectors: {
      container: '[class*="promotion-card"], [class*="promo-card"], [data-testid*="promo"]',
      title: '[class*="promotion-title"], [class*="promo-title"], h3, h2',
      description: '[class*="promotion-description"], [class*="promo-description"], p',
      value: '[class*="promotion-value"], [class*="bonus-amount"], [class*="offer-value"]',
    },
  },
  {
    name: "fanduel",
    url: "https://sportsbook.fanduel.com/promos",
    selectors: {
      container: '[class*="PromoCard"], [class*="promo-card"], [class*="offer-card"]',
      title: '[class*="PromoTitle"], [class*="promo-title"], h3, h2',
      description: '[class*="PromoDescription"], [class*="promo-description"], p',
      value: '[class*="PromoBonus"], [class*="bonus"], [class*="value"]',
    },
  },
  {
    name: "betmgm",
    url: "https://sports.betmgm.com/en/sports/promotions",
    selectors: {
      container: '[class*="promotion-item"], [class*="promo-item"], [class*="offer"]',
      title: '[class*="promotion-title"], [class*="promo-name"], h3, h2',
      description: '[class*="promotion-desc"], [class*="description"], p',
      value: '[class*="bonus-value"], [class*="offer-value"]',
    },
  },
  {
    name: "caesars",
    url: "https://sportsbook.caesars.com/us/nj/promotions",
    selectors: {
      container: '[class*="promo-card"], [class*="promotion"], [class*="offer-card"]',
      title: '[class*="promo-title"], [class*="offer-title"], h3, h2',
      description: '[class*="promo-description"], [class*="offer-description"], p',
      value: '[class*="promo-value"], [class*="bonus"]',
    },
  },
  {
    name: "hardrock",
    url: "https://www.hardrock.bet/promotions",
    selectors: {
      container: '[class*="promo-card"], [class*="promotion-card"], [class*="offer"]',
      title: '[class*="promo-title"], [class*="promotion-title"], h3, h2',
      description: '[class*="promo-description"], [class*="description"], p',
      value: '[class*="bonus"], [class*="value"], [class*="amount"]',
    },
  },
];

function classifyPromoType(title: string, description: string): string {
  const text = (title + " " + description).toLowerCase();
  if (text.includes("parlay") && (text.includes("boost") || text.includes("insurance"))) return "parlay_insurance";
  if (text.includes("odds boost") || text.includes("price boost")) return "odds_boost";
  if (text.includes("free bet") || text.includes("bonus bet") || text.includes("bet credit")) return "free_bet";
  if (text.includes("deposit match") || text.includes("first deposit") || text.includes("match bonus")) return "deposit_match";
  if (text.includes("profit boost") || text.includes("boost")) return "odds_boost";
  if (text.includes("no sweat") || text.includes("insurance") || text.includes("refund")) return "parlay_insurance";
  return "other";
}

function extractValue(title: string, description: string): string | null {
  const text = title + " " + description;
  // Match dollar amounts
  const dollarMatch = text.match(/\$[\d,]+(?:\+)?/);
  if (dollarMatch) return dollarMatch[0];
  // Match percentage boosts
  const pctMatch = text.match(/\d+%\s+(?:boost|match|bonus)/i);
  if (pctMatch) return pctMatch[0];
  // Match "up to $X"
  const upToMatch = text.match(/up\s+to\s+\$[\d,]+/i);
  if (upToMatch) return upToMatch[0];
  return null;
}

export async function runSportsbookPromoScraper(db: ReturnType<typeof drizzle>): Promise<{
  booksScraped: number;
  recordsWritten: number;
}> {
  let booksScraped = 0;
  let recordsWritten = 0;

  const browser = await chromium.launch({ headless: true });

  for (const book of BOOKS) {
    let page;
    try {
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 900 },
      });
      page = await context.newPage();

      await page.goto(book.url, { waitUntil: "networkidle", timeout: 30_000 });

      // Wait for promo cards to appear
      try {
        await page.waitForSelector(book.selectors.container, { timeout: 10_000 });
      } catch {
        console.warn(`[PromoScraper] ${book.name}: no promo containers found`);
        await context.close();
        continue;
      }

      const promos = await page.evaluate((sel) => {
        const cards = Array.from(document.querySelectorAll(sel.container)).slice(0, 20);
        return cards.map((card) => {
          const titleEl  = card.querySelector(sel.title);
          const descEl   = sel.description ? card.querySelector(sel.description) : null;
          const valueEl  = sel.value ? card.querySelector(sel.value) : null;
          const linkEl   = card.querySelector("a");
          return {
            title:       titleEl?.textContent?.trim() ?? "",
            description: descEl?.textContent?.trim() ?? "",
            value:       valueEl?.textContent?.trim() ?? "",
            url:         linkEl?.href ?? "",
          };
        }).filter((p) => p.title.length > 3);
      }, book.selectors);

      const capturedAt = new Date().toISOString();
      const records: Array<typeof schema.bookPromos.$inferInsert> = promos.map((p) => ({
        book:        book.name,
        title:       p.title.slice(0, 255),
        description: p.description || null,
        promoType:   classifyPromoType(p.title, p.description),
        value:       (p.value || extractValue(p.title, p.description))?.slice(0, 127) ?? null,
        url:         p.url || book.url,
        capturedAt,
      }));

      if (records.length) {
        await (db as ReturnType<typeof drizzle<typeof schema>>)
          .insert(schema.bookPromos)
          .values(records);
        recordsWritten += records.length;
      }

      booksScraped++;
      console.log(`[PromoScraper] ${book.name}: ${records.length} promos`);
      await context.close();
    } catch (err) {
      console.warn(`[PromoScraper] ${book.name} failed:`, (err as Error).message);
      if (page) await page.context().close().catch(() => {});
    }
  }

  await browser.close();
  return { booksScraped, recordsWritten };
}
