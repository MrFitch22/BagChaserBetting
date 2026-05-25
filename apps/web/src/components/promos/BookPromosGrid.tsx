"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface BookPromo {
  id: string;
  book: string;
  title: string;
  description: string | null;
  promoType: string | null;
  value: string | null;
  url: string | null;
  capturedAt: string;
}

const BOOK_LOGOS: Record<string, { label: string; color: string }> = {
  draftkings: { label: "DraftKings",  color: "#53d337" },
  fanduel:    { label: "FanDuel",     color: "#1493ff" },
  betmgm:     { label: "BetMGM",      color: "#c9a84c" },
  caesars:    { label: "Caesars",     color: "#0043a8" },
  hardrock:   { label: "Hard Rock",   color: "#e31837" },
};

const PROMO_TYPE_LABELS: Record<string, string> = {
  free_bet:         "Free Bet",
  odds_boost:       "Odds Boost",
  deposit_match:    "Deposit Match",
  parlay_insurance: "Parlay Insurance",
  other:            "Promo",
};

function PromoCard({ promo }: { promo: BookPromo }) {
  const book = BOOK_LOGOS[promo.book] ?? { label: promo.book, color: "#10b981" };
  const typeLabel = PROMO_TYPE_LABELS[promo.promoType ?? "other"] ?? "Promo";

  return (
    <div className="rounded-lg border bg-surface p-4 space-y-2 hover:bg-surface2 transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
          style={{ color: book.color, backgroundColor: `${book.color}18`, border: `1px solid ${book.color}40` }}>
          {book.label}
        </span>
        <span className="text-[10px] font-mono text-muted bg-white/[0.04] border border-border rounded px-1.5 py-0.5">
          {typeLabel}
        </span>
      </div>

      <p className="text-sm font-medium text-text leading-tight">{promo.title}</p>

      {promo.value && (
        <p className="text-xs font-mono font-bold text-sharp-green">{promo.value}</p>
      )}

      {promo.description && (
        <p className="text-[11px] text-muted leading-relaxed line-clamp-2">{promo.description}</p>
      )}

      {promo.url && (
        <a
          href={promo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-xs font-mono font-semibold text-muted border border-border rounded py-1.5 mt-1 hover:text-text hover:border-white/20 transition-colors"
        >
          View Offer →
        </a>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 animate-pulse space-y-3">
      <div className="h-4 w-1/3 rounded bg-white/5" />
      <div className="h-4 w-2/3 rounded bg-white/5" />
      <div className="h-3 w-1/4 rounded bg-white/5" />
    </div>
  );
}

export function BookPromosGrid() {
  const { data: promos, isLoading } = useQuery({
    queryKey: ["promos-books"],
    queryFn: () => api.get<BookPromo[]>("/api/promos/books"),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!promos?.length) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-muted text-sm">No active promotions found. Run the scraper to populate.</p>
      </div>
    );
  }

  // Group by book
  const byBook = new Map<string, BookPromo[]>();
  for (const p of promos) {
    if (!byBook.has(p.book)) byBook.set(p.book, []);
    byBook.get(p.book)!.push(p);
  }

  const bookOrder = ["draftkings", "fanduel", "betmgm", "caesars", "hardrock"];
  const sorted = [...byBook.entries()].sort(
    ([a], [b]) => bookOrder.indexOf(a) - bookOrder.indexOf(b)
  );

  return (
    <div className="space-y-6">
      {sorted.map(([book, items]) => {
        const meta = BOOK_LOGOS[book] ?? { label: book, color: "#10b981" };
        return (
          <div key={book}>
            <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
              <span className="text-xs text-muted font-normal">({items.length} active)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((p) => <PromoCard key={p.id} promo={p} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
