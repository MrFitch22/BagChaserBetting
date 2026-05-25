"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface BookEntry { book: string; price: number; point: number | null }
interface Line       { label: string; books: BookEntry[]; bestPrice: number; bestBook: string }
interface Market     { market: string; lines: Line[] }
interface GameOdds   { gameId: string; sport: string; homeTeam: string; awayTeam: string; gameTime: string; markets: Market[] }

const MARKET_LABELS: Record<string, string> = {
  spreads:  "Spread",
  h2h:      "Moneyline",
  totals:   "Total",
};

const BOOK_DISPLAY: Record<string, string> = {
  pinnacle:   "Pinnacle",
  draftkings: "DraftKings",
  fanduel:    "FanDuel",
  betmgm:     "BetMGM",
  caesars:    "Caesars",
  pointsbet:  "PointsBet",
  bet365:     "Bet365",
};

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

// Higher American odds = better value for the bettor
function isBest(price: number, bestPrice: number): boolean {
  return price === bestPrice;
}

function LineRow({ line, allBooks }: { line: Line; allBooks: string[] }) {
  const bookMap = new Map(line.books.map((b) => [b.book, b]));

  return (
    <div className="grid gap-px" style={{ gridTemplateColumns: `1fr repeat(${allBooks.length}, minmax(72px, 1fr))` }}>
      <div className="px-3 py-2.5 text-xs font-medium text-text truncate bg-surface">
        {line.label}
      </div>
      {allBooks.map((book) => {
        const entry = bookMap.get(book);
        const best  = entry ? isBest(entry.price, line.bestPrice) : false;
        return (
          <div
            key={book}
            className="px-2 py-2.5 text-center text-xs font-mono font-semibold transition-colors"
            style={{
              backgroundColor: best ? "rgba(16,185,129,0.12)" : "var(--surface)",
              color: entry ? (best ? "#10b981" : "#dce4f0") : "rgba(255,255,255,0.15)",
              borderLeft: best ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
            }}
          >
            {entry ? (
              <>
                {formatOdds(entry.price)}
                {entry.point !== null && (
                  <span className="block text-[9px] text-muted font-normal">
                    {entry.point > 0 ? `+${entry.point}` : entry.point}
                  </span>
                )}
              </>
            ) : (
              <span className="opacity-30">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GameCard({ game }: { game: GameOdds }) {
  const allBooks = [...new Set(game.markets.flatMap((m) => m.lines.flatMap((l) => l.books.map((b) => b.book))))];
  const sortedBooks = ["pinnacle", "draftkings", "fanduel", "betmgm", "caesars", "pointsbet", "bet365"]
    .filter((b) => allBooks.includes(b))
    .concat(allBooks.filter((b) => !["pinnacle","draftkings","fanduel","betmgm","caesars","pointsbet","bet365"].includes(b)));

  const [activeMarket, setActiveMarket] = useState(game.markets[0]?.market ?? "spreads");
  const market = game.markets.find((m) => m.market === activeMarket) ?? game.markets[0];

  if (!market) return null;

  const gameTime = new Date(game.gameTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      {/* Game header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface2 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div>
          <span className="text-sm font-medium text-text">{game.awayTeam} @ {game.homeTeam}</span>
          <span className="ml-2 text-xs text-muted font-mono">{gameTime}</span>
        </div>
        <span className="text-[10px] font-mono text-muted bg-white/[0.04] border border-border rounded px-1.5 py-0.5">
          {game.sport}
        </span>
      </div>

      {/* Market tabs */}
      <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        {game.markets.map((m) => (
          <button
            key={m.market}
            onClick={() => setActiveMarket(m.market)}
            className={[
              "px-3 py-1.5 text-xs font-mono font-semibold transition-colors",
              activeMarket === m.market
                ? "text-sharp-green border-b-2 border-sharp-green bg-sharp-green/5"
                : "text-muted hover:text-text",
            ].join(" ")}
          >
            {MARKET_LABELS[m.market] ?? m.market}
          </button>
        ))}
      </div>

      {/* Book header row */}
      <div
        className="grid gap-px bg-surface2 border-b"
        style={{
          gridTemplateColumns: `1fr repeat(${sortedBooks.length}, minmax(72px, 1fr))`,
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        <div className="px-3 py-1.5 text-[10px] font-mono text-muted uppercase tracking-wide">Side</div>
        {sortedBooks.map((b) => (
          <div key={b} className="px-2 py-1.5 text-[10px] font-mono text-muted text-center uppercase tracking-wide">
            {BOOK_DISPLAY[b] ?? b}
          </div>
        ))}
      </div>

      {/* Lines */}
      <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.04)" }}>
        {market.lines.map((line) => (
          <LineRow key={line.label} line={line} allBooks={sortedBooks} />
        ))}
      </div>

      {/* Best bet callout */}
      {market.lines.length > 0 && (
        <div className="px-3 py-2 bg-sharp-green/[0.04] border-t text-[10px] text-muted font-mono" style={{ borderColor: "rgba(16,185,129,0.15)" }}>
          Best available:{" "}
          {market.lines.map((l) => (
            <span key={l.label} className="mr-3">
              <span className="text-text">{l.label.split(" ").slice(-1)[0]}</span>
              {" → "}
              <span className="text-sharp-green">{BOOK_DISPLAY[l.bestBook] ?? l.bestBook} {formatOdds(l.bestPrice)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface animate-pulse h-40" />
      ))}
    </div>
  );
}

export function LineShoppingTable() {
  const { data: games, isLoading } = useQuery({
    queryKey: ["line-shopping"],
    queryFn:  () => api.get<GameOdds[]>("/api/line-shopping"),
    refetchInterval: 2 * 60 * 1000, // refresh every 2 min — odds move fast
    staleTime: 60 * 1000,
  });

  if (isLoading) return <Skeleton />;

  if (!games?.length) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-muted text-sm">No odds available. Run the odds ingest pipeline first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {games.map((game) => (
        <GameCard key={game.gameId} game={game} />
      ))}
    </div>
  );
}
