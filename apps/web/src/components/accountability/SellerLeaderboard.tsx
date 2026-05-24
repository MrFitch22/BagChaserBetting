"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { SocialAccount } from "@sharp-edge/shared";
import { TierBadge } from "@sharp-edge/ui";
import { api } from "@/lib/api";

export function SellerLeaderboard() {
  const { data: sellers, isLoading } = useQuery({
    queryKey: ["sellers-leaderboard"],
    queryFn: () => api.get<SocialAccount[]>("/api/sellers?limit=50"),
    refetchInterval: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border animate-pulse last:border-0">
            <div className="h-8 w-8 rounded-full bg-white/5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-mono text-muted border-b border-border bg-surface2">
        <span>#</span>
        <span>Handle</span>
        <span className="text-right">W-L</span>
        <span className="text-right">WIN%</span>
        <span className="text-right">ROI</span>
        <span className="text-right">Tier</span>
      </div>

      {sellers?.map((seller, i) => {
        const total = seller.verifiedW + seller.verifiedL;
        const winPct = total > 0 ? ((seller.verifiedW / total) * 100).toFixed(1) : "—";
        const roi = seller.verifiedRoi != null ? parseFloat(String(seller.verifiedRoi)) : null;

        return (
          <Link
            key={seller.id}
            href={`/accountability/${seller.handle}?platform=${seller.platform}`}
            className="grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-border hover:bg-surface2 transition-colors last:border-0"
          >
            <span className="text-xs font-mono text-muted">{i + 1}</span>

            <div>
              <span className="text-sm font-medium text-text">@{seller.handle}</span>
              <span className="ml-1.5 text-xs text-muted">{seller.platform}</span>
              {seller.isFraud && (
                <span className="ml-1.5 text-[10px] font-bold text-sharp-red bg-sharp-red/10 border border-sharp-red/30 rounded px-1 py-0.5 font-mono">
                  FRAUD
                </span>
              )}
            </div>

            <span className="text-xs font-mono text-right text-muted">
              {seller.verifiedW}-{seller.verifiedL}
            </span>
            <span className="text-xs font-mono text-right text-text">{winPct}%</span>
            <span
              className="text-xs font-mono text-right font-bold"
              style={{ color: roi != null && roi > 0 ? "#10b981" : "#ef4444" }}
            >
              {roi != null ? `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
            </span>

            <span className="flex justify-end">
              <TierBadge tier={seller.tier as Parameters<typeof TierBadge>[0]["tier"]} size="sm" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
