"use client";

import { useQuery } from "@tanstack/react-query";
import type { SavedParlay } from "@sharp-edge/shared";
import { api } from "@/lib/api";

export function LiveParlaySidebar() {
  const { data: parlays } = useQuery({
    queryKey: ["saved-parlays"],
    retry: false,
    queryFn: () => api.get<SavedParlay[]>("/api/parlays"),
    refetchInterval: 30_000,
  });

  const activeParlays = parlays?.filter((p) => p.status === "placed") ?? [];

  if (!activeParlays.length) return null;

  return (
    <aside
      className="hidden xl:flex w-72 flex-col border-l border-border bg-surface h-full overflow-y-auto"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-medium text-text">Active Parlays</h2>
      </div>

      <div className="p-3 space-y-3">
        {activeParlays.map((parlay) => (
          <div key={parlay.id} className="rounded-md border border-border bg-surface2 p-3 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted">{parlay.sportsbook ?? "Unknown"}</span>
              <span style={{ color: (parlay.edgeScore ?? 0) > 0 ? "#10b981" : "#ef4444" }}>
                {(parlay.edgeScore ?? 0) > 0 ? "+" : ""}
                {(parlay.edgeScore ?? 0).toFixed(1)}% edge
              </span>
            </div>

            <div className="space-y-1">
              {parlay.legs.map((leg, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-text truncate">{leg.label}</span>
                  <span className="font-mono text-muted ml-2">
                    {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border flex justify-between text-xs font-mono">
              <span className="text-muted">Payout</span>
              <span className="font-bold text-text">
                {(parlay.payoutOdds ?? 0) > 0 ? `+${parlay.payoutOdds}` : parlay.payoutOdds}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
