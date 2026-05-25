"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface CasinoPromo {
  id: string;
  casino: string;
  title: string;
  description: string | null;
  promoType: string | null;
  value: string | null;
  url: string | null;
  rating: string | null;
  capturedAt: string;
}

const PROMO_TYPE_LABELS: Record<string, string> = {
  welcome_bonus: "Welcome Bonus",
  free_spins:    "Free Spins",
  reload:        "Reload Bonus",
  cashback:      "Cashback",
  other:         "Promo",
};

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="text-[10px] font-mono text-yellow-400">
      {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(5 - full - (half ? 1 : 0))}
      <span className="text-muted ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function CasinoCard({ promo }: { promo: CasinoPromo }) {
  const typeLabel = PROMO_TYPE_LABELS[promo.promoType ?? "other"] ?? "Promo";
  const rating = promo.rating ? parseFloat(promo.rating) : null;

  return (
    <div className="rounded-lg border bg-surface p-4 space-y-2 hover:bg-surface2 transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text truncate max-w-[140px]">{promo.casino}</span>
        <span className="text-[10px] font-mono text-muted bg-white/[0.04] border border-border rounded px-1.5 py-0.5 shrink-0">
          {typeLabel}
        </span>
      </div>

      <p className="text-sm font-medium text-text leading-tight">{promo.title}</p>

      {promo.value && (
        <p className="text-xs font-mono font-bold text-sharp-green">{promo.value}</p>
      )}

      {rating !== null && <RatingStars rating={rating} />}

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

export function CasinoPromosGrid() {
  const { data: promos, isLoading } = useQuery({
    queryKey: ["promos-casinos"],
    queryFn: () => api.get<CasinoPromo[]>("/api/promos/casinos"),
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
        <p className="text-muted text-sm">No casino promotions found. Run the scraper to populate.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {promos.map((p) => <CasinoCard key={p.id} promo={p} />)}
    </div>
  );
}
